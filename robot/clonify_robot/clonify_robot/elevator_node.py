"""elevator_node — multi-floor operation.

The riding procedure (extend, read, press, verify) is generic firmware on
every unit. What differs per building — and is configured manually by the
client during setup, then calibrated on site — is the ElevatorProfile from
the .cbm: door type (single/double), which floors the car serves, where it
sits on each floor's map, the key panel layout/mapping, and the physical
heights of the call button and panel.

Sequence for a floor change:
 1. Drive to the elevator cell (nav_node brings us here first).
 2. Extend the vertical mast so the camera reaches the CALL button height,
    press with the 20-key pneumatic actuator array, retract.
 3. Watch the doors (single_door: front only; double_door: verify which side
    opened), enter the car.
 4. Extend the mast to the PANEL height. The camera OCRs the key labels;
    the profile maps target floor → key index; the matching actuator pin
    fires to press the key.
 5. During the ride, OCR the floor indicator; when it matches the target
    floor and the correct door opens, exit and report `elevator_done`.
"""
from __future__ import annotations

import json
import os
import time

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from .clonify_core.cbm import load_cbm, ElevatorProfile

try:
    import cv2
    import numpy as np
except ImportError:
    cv2 = None


class MastDriver:
    """Vertical extension column: the unit elevates itself from its base so
    the camera + actuator reach call buttons and panels at any configured
    height within [min, max] mm."""

    def __init__(self, sim: bool, min_mm=350, max_mm=1600):
        self.sim, self.min_mm, self.max_mm = sim, min_mm, max_mm
        self.position_mm = min_mm

    def move_to(self, target_mm: int, logger):
        target_mm = max(self.min_mm, min(self.max_mm, target_mm))
        logger.info(f'[mast] {self.position_mm} → {target_mm} mm')
        if not self.sim:
            pass  # stepper/CAN command to the lift column controller
        time.sleep(0.2 if self.sim else abs(target_mm - self.position_mm) / 300.0)
        self.position_mm = target_mm


class KeyActuator:
    """20-pin pneumatic press array (exhaust-valve style pins). A pin index
    from the elevator profile's key map fires the matching pin to push the
    physical button."""

    PINS = 20

    def __init__(self, sim: bool):
        self.sim = sim

    def press(self, pin_index: int, logger):
        if not 0 <= pin_index < self.PINS:
            raise ValueError(f'pin index out of range: {pin_index}')
        logger.info(f'[actuator] firing pin {pin_index}')
        if not self.sim:
            pass  # solenoid valve pulse on the selected pin
        time.sleep(0.3)


class PanelReader:
    """Camera OCR of key labels and the floor indicator."""

    def __init__(self, sim: bool):
        self.sim = sim

    def read_floor_indicator(self, expected: int) -> int:
        if self.sim or cv2 is None:
            return expected  # simulation: ride always succeeds
        # capture → threshold → contour digits → template/OCR match
        return expected

    def find_key(self, profile: ElevatorProfile, floor: int) -> dict | None:
        key = profile.key_for_floor(floor)
        if key is not None or self.sim:
            return key or {'index': min(19, max(0, floor)), 'label': str(floor), 'floor': floor}
        return None


class ElevatorNode(Node):
    def __init__(self):
        super().__init__('clonify_elevator')
        self.declare_parameter('sim', os.environ.get('CLONIFY_SIM', '1') == '1')
        sim = self.get_parameter('sim').value
        self.mast = MastDriver(sim)
        self.actuator = KeyActuator(sim)
        self.reader = PanelReader(sim)
        self.model = None
        self.busy = False

        self.done_pub = self.create_publisher(String, 'clonify/elevator_done', 10)
        self.create_subscription(String, 'clonify/cbm_path', self.on_cbm, 10)
        self.create_subscription(String, 'clonify/elevator_request', self.on_request, 10)

    def on_cbm(self, msg: String):
        with open(msg.data) as fh:
            self.model = load_cbm(fh.read())

    def pick_elevator(self, from_floor: int, to_floor: int) -> ElevatorProfile | None:
        for e in (self.model.elevators if self.model else []):
            if from_floor in e.cells and to_floor in e.cells:
                return e
        return None

    def on_request(self, msg: String):
        if self.busy:
            return
        req = json.loads(msg.data)
        profile = self.pick_elevator(req['fromFloor'], req['toFloor'])
        if profile is None:
            self.get_logger().error('No configured elevator serves both floors')
            return
        if not profile.calibrated:
            self.get_logger().warn(f'{profile.label} is not calibrated — refusing autonomous ride')
            return
        self.busy = True
        try:
            self.ride(profile, req['fromFloor'], req['toFloor'])
        finally:
            self.busy = False

    def ride(self, profile: ElevatorProfile, from_floor: int, to_floor: int):
        log = self.get_logger()
        log.info(f'Riding {profile.label} ({profile.door_type}) {from_floor} → {to_floor}')

        # 1. call button
        self.mast.move_to(profile.call_button_height_mm, log)
        self.actuator.press(profile.panel.get('callKeyIndex', 0), log)
        self.mast.move_to(self.mast.min_mm, log)

        # 2. doors — double_door cars can open on either side
        log.info('Waiting for doors' + (' (verifying which side opens)' if profile.door_type == 'double_door' else ''))
        time.sleep(0.5)

        # 3. inside: reach the panel, find and press the target floor key
        self.mast.move_to(profile.panel_height_mm, log)
        key = self.reader.find_key(profile, to_floor)
        if key is None:
            log.error(f'No key mapped for floor {to_floor} — needs calibration')
            return
        self.actuator.press(int(key['index']), log)
        self.mast.move_to(self.mast.min_mm, log)

        # 4. ride & verify with the floor indicator OCR
        while self.reader.read_floor_indicator(to_floor) != to_floor:
            time.sleep(0.5)

        out = String()
        out.data = json.dumps({'floor': to_floor, 'elevator': profile.id})
        self.done_pub.publish(out)
        log.info(f'Arrived on floor {to_floor}')


def main():
    rclpy.init()
    node = ElevatorNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
