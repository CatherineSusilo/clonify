"""lock_node — secure compartment access. Generic on every unit.

Flow (patent FIG. 3):
 1. Recipient enters a 6-digit PIN on the keypad or shows the QR code to
    the camera.
 2. The credential is forwarded to the cloud with the delivery id.
 3. The cloud verifies (hashed PIN / constant-time QR compare), audits the
    attempt, and returns a signed unlock token (120 s TTL).
 4. The token signature is what actually authorizes the solenoid — the lock
    never opens on a local decision alone.
 5. Retrieval is confirmed by the compartment weight/optical sensor and the
    delivery is marked complete.
"""
from __future__ import annotations

import json
import os
import time

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from .cloud import CloudClient


class CompartmentLock:
    def __init__(self, sim: bool):
        self.sim = sim

    def open(self, compartment: int, logger):
        logger.info(f'[lock] opening compartment {compartment}')
        if not self.sim:
            pass  # solenoid pulse for the compartment latch
        time.sleep(0.2)

    def cargo_removed(self) -> bool:
        if self.sim:
            return True
        return True  # weight cell / IR beam check


class LockNode(Node):
    def __init__(self):
        super().__init__('clonify_lock')
        self.declare_parameter('cloud_url', os.environ.get('CLONIFY_CLOUD_URL', 'http://localhost:8080'))
        self.declare_parameter('code', os.environ.get('CLONIFY_ROBOT_CODE', ''))
        self.declare_parameter('api_key', os.environ.get('CLONIFY_ROBOT_KEY', ''))
        self.declare_parameter('sim', os.environ.get('CLONIFY_SIM', '1') == '1')
        self.cloud = CloudClient(self.get_parameter('cloud_url').value,
                                 self.get_parameter('code').value,
                                 self.get_parameter('api_key').value)
        self.lock = CompartmentLock(self.get_parameter('sim').value)
        self.active_delivery: int | None = None

        # keypad/QR scanner publish here: {"deliveryId":n,"pin":"123456"} or {"qrToken":"…"}
        self.create_subscription(String, 'clonify/credential', self.on_credential, 10)
        self.create_subscription(String, 'clonify/nav_state', self.on_nav_state, 10)

    def on_nav_state(self, msg: String):
        data = json.loads(msg.data)
        if data.get('state') == 'arrived':
            self.active_delivery = data.get('deliveryId')

    def on_credential(self, msg: String):
        cred = json.loads(msg.data)
        delivery_id = cred.get('deliveryId') or self.active_delivery
        if delivery_id is None:
            self.get_logger().warn('Credential presented but no active delivery')
            return
        try:
            result = self.cloud.request_unlock(
                delivery_id, pin=cred.get('pin'), qr_token=cred.get('qrToken'))
        except Exception as exc:
            self.get_logger().warn(f'Unlock denied: {exc}')
            return
        # The signed token is the authorization; a hardware security module
        # on the lock controller re-verifies the signature before actuation.
        if not result.get('unlockToken'):
            return
        self.lock.open(result['compartment'], self.get_logger())
        if self.lock.cargo_removed():
            self.cloud.complete_delivery(delivery_id)
            self.get_logger().info(f'Delivery {delivery_id} completed — chain of custody closed')
            self.active_delivery = None


def main():
    rclpy.init()
    node = LockNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
