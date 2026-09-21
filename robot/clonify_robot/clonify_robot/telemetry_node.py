"""telemetry_node — pose/battery/status uplink + dispatch downlink.

Posts the fused pose to the cloud at 2 Hz; the response piggybacks any
queued dispatcher commands (delivery routes, go-charge), which are relayed
to nav_node on `clonify/dispatch`. This is the same telemetry pipeline the
virtual (simulated) robots feed server-side, so the dashboard renders both
identically.
"""
from __future__ import annotations

import json
import os

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from .cloud import CloudClient

LOW_BATTERY = 20.0


class TelemetryNode(Node):
    def __init__(self):
        super().__init__('clonify_telemetry')
        self.declare_parameter('cloud_url', os.environ.get('CLONIFY_CLOUD_URL', 'http://localhost:8080'))
        self.declare_parameter('code', os.environ.get('CLONIFY_ROBOT_CODE', ''))
        self.declare_parameter('api_key', os.environ.get('CLONIFY_ROBOT_KEY', ''))
        self.cloud = CloudClient(self.get_parameter('cloud_url').value,
                                 self.get_parameter('code').value,
                                 self.get_parameter('api_key').value)
        self.pose = {'x': 1.0, 'y': 1.0, 'floor': 0, 'heading': 0.0}
        self.battery = 100.0
        self.status = 'idle'

        self.dispatch_pub = self.create_publisher(String, 'clonify/dispatch', 10)
        self.create_subscription(String, 'clonify/pose', self.on_pose, 10)
        self.create_subscription(String, 'clonify/nav_state', self.on_nav_state, 10)
        self.create_subscription(String, 'clonify/incident', self.on_incident, 10)
        self.create_timer(0.5, self.push)

    def on_pose(self, msg: String):
        data = json.loads(msg.data)
        self.pose.update({k: data[k] for k in ('x', 'y', 'floor', 'heading') if k in data})
        if 'battery' in data:
            self.battery = data['battery']

    def on_nav_state(self, msg: String):
        data = json.loads(msg.data)
        state = data.get('state')
        if state == 'arrived':
            self.status = 'idle'
            if data.get('deliveryId'):
                try:
                    self.cloud.delivery_status(data['deliveryId'], 'arrived')
                except Exception as exc:
                    self.get_logger().warn(f'status report failed: {exc}')
        elif state == 'at_pickup':
            self.status = 'delivering'
            if data.get('deliveryId'):
                try:
                    self.cloud.delivery_status(data['deliveryId'], 'awaiting_load')
                except Exception as exc:
                    self.get_logger().warn(f'status report failed: {exc}')

    def on_incident(self, msg: String):
        data = json.loads(msg.data)
        try:
            self.cloud.incident(data.get('severity', 'INFO'), data.get('kind', 'unknown'), data)
        except Exception as exc:
            self.get_logger().warn(f'incident report failed: {exc}')

    def push(self):
        try:
            resp = self.cloud.telemetry({
                **self.pose,
                'battery': self.battery,
                'status': self.status,
            })
        except Exception as exc:
            self.get_logger().warn(f'telemetry failed: {exc}')
            return
        for cmd in resp.get('commands', []):
            self.status = 'delivering' if cmd.get('type') == 'route' else 'returning'
            out = String()
            out.data = json.dumps(cmd)
            self.dispatch_pub.publish(out)


def main():
    rclpy.init()
    node = TelemetryNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
