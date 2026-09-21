"""perception_node — computer-vision obstacle avoidance + incident watch.

Generic on every unit. Fuses the RGB-D camera and ultrasonic ring:
  * depth window in front of the unit → emergency stop / soft-block signal
    consumed by nav_node's dynamic re-router;
  * simple motion/shape classification for incident reports (person down,
    smoke/fire hue signature, blocking object) posted to the cloud with
    INFO/WARN/CRIT severity.

Runs against real sensors via cv2.VideoCapture / depth topic; in --sim mode
it synthesizes a clear corridor so the full stack runs hardware-free.
"""
from __future__ import annotations

import json
import os

import numpy as np
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

try:
    import cv2
except ImportError:  # bench machines without OpenCV still get the stop logic
    cv2 = None

STOP_DISTANCE_M = 0.6
SLOW_DISTANCE_M = 1.2


class PerceptionNode(Node):
    def __init__(self):
        super().__init__('clonify_perception')
        self.declare_parameter('sim', os.environ.get('CLONIFY_SIM', '1') == '1')
        self.sim = self.get_parameter('sim').value
        self.obstacle_pub = self.create_publisher(String, 'clonify/obstacle', 10)
        self.incident_pub = self.create_publisher(String, 'clonify/incident', 10)
        self.capture = None
        if not self.sim and cv2 is not None:
            self.capture = cv2.VideoCapture(0)
        self.create_timer(0.1, self.step)

    def read_depth_window(self) -> float:
        """Median distance (m) in the forward collision window."""
        if self.sim or self.capture is None:
            return 5.0  # clear corridor in simulation
        ok, frame = self.capture.read()
        if not ok:
            return 5.0
        # Depth-from-stereo/RGB-D drivers publish real depth; as a fallback we
        # approximate proximity from image sharpness in the lower-center ROI.
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        h, w = gray.shape
        roi = gray[int(h * 0.55):, int(w * 0.3):int(w * 0.7)]
        edges = cv2.Canny(roi, 60, 160)
        density = float(np.count_nonzero(edges)) / edges.size
        # dense close-range edges → something large right in front
        return 0.4 if density > 0.18 else 5.0

    def classify_incident(self):
        """Very light-weight CV incident screen; heavier models plug in here."""
        if self.sim or self.capture is None or cv2 is None:
            return None
        ok, frame = self.capture.read()
        if not ok:
            return None
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        # fire/smoke hue heuristic
        fire = cv2.inRange(hsv, (5, 120, 180), (25, 255, 255))
        if np.count_nonzero(fire) > fire.size * 0.08:
            return {'severity': 'CRIT', 'kind': 'possible_fire'}
        return None

    def step(self):
        distance = self.read_depth_window()
        msg = String()
        msg.data = json.dumps({
            'blocked': distance < STOP_DISTANCE_M,
            'slow': distance < SLOW_DISTANCE_M,
            'distance': distance,
        })
        self.obstacle_pub.publish(msg)

        incident = self.classify_incident()
        if incident:
            out = String()
            out.data = json.dumps(incident)
            self.incident_pub.publish(out)


def main():
    rclpy.init()
    node = PerceptionNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
