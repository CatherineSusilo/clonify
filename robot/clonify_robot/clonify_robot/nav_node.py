"""nav_node — global route planning and waypoint following.

Generic on every unit. Routes arrive from the cloud dispatcher (already
Dijkstra-optimal over the CBM graph); this node can also replan locally
with the identical algorithm when perception blocks an edge. Local motion
is a simple pure-pursuit follower with dynamic re-route: when the
perception node reports an obstacle dead ahead, the blocked cell's edges
are penalized and the remaining route is recomputed — no global stop.
"""
from __future__ import annotations

import json
import math

import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from std_msgs.msg import String

from .clonify_core.cbm import load_cbm
from .clonify_core.dijkstra import dijkstra, nearest_node

SPEED = 1.2           # m/s cruise
TURN_GAIN = 1.8
WAYPOINT_TOL = 0.15   # m


class NavNode(Node):
    def __init__(self):
        super().__init__('clonify_nav')
        self.model = None
        self.route = []          # [{nodeId, floor, x, y, type}]
        self.route_idx = 0
        self.delivery_id = None
        self.pickup_index = -1
        self.pose = {'x': 1.0, 'y': 1.0, 'floor': 0, 'heading': 0.0}
        self.blocked = False

        self.cmd_pub = self.create_publisher(Twist, 'cmd_vel', 10)
        self.state_pub = self.create_publisher(String, 'clonify/nav_state', 10)
        self.elevator_pub = self.create_publisher(String, 'clonify/elevator_request', 10)

        self.create_subscription(String, 'clonify/cbm_path', self.on_cbm, 10)
        self.create_subscription(String, 'clonify/dispatch', self.on_dispatch, 10)
        self.create_subscription(String, 'clonify/pose', self.on_pose, 10)
        self.create_subscription(String, 'clonify/obstacle', self.on_obstacle, 10)
        self.create_subscription(String, 'clonify/elevator_done', self.on_elevator_done, 10)

        self.create_timer(0.1, self.step)

    def on_cbm(self, msg: String):
        with open(msg.data) as fh:
            self.model = load_cbm(fh.read())
        self.get_logger().info(f'Loaded building model v{self.model.version}')

    def on_pose(self, msg: String):
        self.pose.update(json.loads(msg.data))

    def on_dispatch(self, msg: String):
        cmd = json.loads(msg.data)
        if cmd.get('type') in ('route', 'charge'):
            self.route = cmd['waypoints']
            self.route_idx = 0
            self.delivery_id = cmd.get('deliveryId')
            self.pickup_index = cmd.get('pickupIndex', -1)
            self.get_logger().info(f'New route: {len(self.route)} waypoints '
                                   f'({"delivery " + str(self.delivery_id) if self.delivery_id else "charging"})')

    def on_obstacle(self, msg: String):
        """Perception says the cell ahead is blocked → penalize and replan."""
        data = json.loads(msg.data)
        self.blocked = data.get('blocked', False)
        if not (self.blocked and self.model and self.route and self.route_idx < len(self.route)):
            return
        ahead = self.route[self.route_idx]
        for edge in self.model.adjacency.get(ahead['nodeId'], []):
            edge['w'] += 50.0  # soft-block: avoid unless there is no other way
        start = nearest_node(self.model, self.pose['floor'], self.pose['x'], self.pose['y'])
        goal = self.route[-1]['nodeId']
        result = dijkstra(self.model, start, goal)
        if result:
            path, _ = result
            self.route = [self._waypoint(nid) for nid in path]
            self.route_idx = 0
            self.get_logger().warn('Obstacle ahead — dynamically re-routed')

    def _waypoint(self, node_id: str) -> dict:
        n = self.model.nodes[node_id]
        return {'nodeId': node_id, 'floor': n['floor'], 'x': n['x'], 'y': n['y'], 'type': n.get('type', 'cell')}

    def on_elevator_done(self, msg: String):
        data = json.loads(msg.data)
        self.pose['floor'] = data['floor']
        self.get_logger().info(f"Elevator ride complete — now on floor {data['floor']}")

    def step(self):
        if not self.route or self.route_idx >= len(self.route):
            self.cmd_pub.publish(Twist())
            return
        if self.blocked:
            self.cmd_pub.publish(Twist())  # perception overrides motion
            return

        wp = self.route[self.route_idx]

        # Floor change → hand over to the elevator node and wait.
        if wp['floor'] != self.pose['floor']:
            req = String()
            req.data = json.dumps({'fromFloor': self.pose['floor'], 'toFloor': wp['floor']})
            self.elevator_pub.publish(req)
            self.cmd_pub.publish(Twist())
            return

        dx, dy = wp['x'] - self.pose['x'], wp['y'] - self.pose['y']
        dist = math.hypot(dx, dy)
        if dist < WAYPOINT_TOL:
            self.route_idx += 1
            if self.route_idx == self.pickup_index + 1 and self.delivery_id:
                self._publish_state('at_pickup')
            if self.route_idx >= len(self.route):
                self._publish_state('arrived')
            return

        target = math.atan2(dy, dx)
        err = math.atan2(math.sin(target - self.pose['heading']), math.cos(target - self.pose['heading']))
        cmd = Twist()
        cmd.linear.x = SPEED * max(0.2, 1 - abs(err))
        cmd.angular.z = TURN_GAIN * err
        self.cmd_pub.publish(cmd)

    def _publish_state(self, state: str):
        msg = String()
        msg.data = json.dumps({'state': state, 'deliveryId': self.delivery_id})
        self.state_pub.publish(msg)


def main():
    rclpy.init()
    node = NavNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
