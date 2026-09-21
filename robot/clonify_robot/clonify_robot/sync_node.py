"""sync_node — Wi-Fi provisioning, pairing and building model sync.

Building setup cannot complete until the robot is on the building Wi-Fi:
with no connection, the node starts a `CLONIFY-SETUP-<code>` hotspot with a
captive portal (port 8000) where the client enters the building SSID +
password. After joining, the node reports `provisioned` to the cloud, pulls
the compiled .cbm building model + elevator profiles, writes them to disk
for the other nodes, and re-syncs whenever the cloud publishes a newer
model version.
"""
from __future__ import annotations

import json
import os
import subprocess
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from .cloud import CloudClient

DATA_DIR = os.environ.get('CLONIFY_ROBOT_DATA', '/var/lib/clonify')


class WifiManager:
    """nmcli wrapper; --sim mode fakes success for bench development."""

    def __init__(self, sim: bool):
        self.sim = sim
        self.connected_ssid: str | None = None

    def is_connected(self) -> bool:
        if self.sim:
            return self.connected_ssid is not None
        try:
            out = subprocess.run(
                ['nmcli', '-t', '-f', 'ACTIVE,SSID', 'dev', 'wifi'],
                capture_output=True, text=True, timeout=10,
            ).stdout
            for line in out.splitlines():
                if line.startswith('yes:'):
                    self.connected_ssid = line.split(':', 1)[1]
                    return True
        except Exception:
            pass
        return False

    def start_hotspot(self, code: str):
        if self.sim:
            return
        subprocess.run(['nmcli', 'dev', 'wifi', 'hotspot', 'ssid', f'CLONIFY-SETUP-{code}',
                        'password', 'clonify-setup'], check=False)

    def join(self, ssid: str, password: str) -> bool:
        if self.sim:
            self.connected_ssid = ssid
            return True
        r = subprocess.run(['nmcli', 'dev', 'wifi', 'connect', ssid, 'password', password],
                           capture_output=True)
        if r.returncode == 0:
            self.connected_ssid = ssid
            return True
        return False


class SyncNode(Node):
    def __init__(self):
        super().__init__('clonify_sync')
        self.declare_parameter('cloud_url', os.environ.get('CLONIFY_CLOUD_URL', 'http://localhost:8080'))
        self.declare_parameter('code', os.environ.get('CLONIFY_ROBOT_CODE', ''))
        self.declare_parameter('api_key', os.environ.get('CLONIFY_ROBOT_KEY', ''))
        self.declare_parameter('sim', os.environ.get('CLONIFY_SIM', '1') == '1')

        code = self.get_parameter('code').value
        self.cloud = CloudClient(self.get_parameter('cloud_url').value, code,
                                 self.get_parameter('api_key').value)
        self.wifi = WifiManager(self.get_parameter('sim').value)
        self.cbm_pub = self.create_publisher(String, 'clonify/cbm_path', 10)
        self.synced_version = 0

        os.makedirs(DATA_DIR, exist_ok=True)
        if not self.wifi.is_connected():
            self.get_logger().warn('No Wi-Fi — starting CLONIFY-SETUP hotspot + captive portal :8000')
            self.wifi.start_hotspot(code)
            threading.Thread(target=self._portal, daemon=True).start()
        else:
            self._provision_and_sync()

        self.create_timer(60.0, self._resync_check)

    # captive portal asking for the building Wi-Fi credentials
    def _portal(self):
        node = self

        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.send_header('Content-Type', 'text/html')
                self.end_headers()
                self.wfile.write(
                    b'<html><body style="font-family:monospace;background:#030b06;color:#37ff8b">'
                    b'<h2>CLONIFY UNIT SETUP</h2>'
                    b'<p>Connect this robot to the building Wi-Fi to finish setup.</p>'
                    b'<form method="post"><input name="ssid" placeholder="Building Wi-Fi SSID"><br>'
                    b'<input name="password" type="password" placeholder="Password"><br>'
                    b'<button>CONNECT</button></form></body></html>')

            def do_POST(self):
                from urllib.parse import parse_qs
                length = int(self.headers.get('Content-Length', 0))
                form = parse_qs(self.rfile.read(length).decode())
                ssid = form.get('ssid', [''])[0]
                password = form.get('password', [''])[0]
                ok = node.wifi.join(ssid, password)
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'CONNECTED — setup continuing' if ok else b'FAILED — check credentials')
                if ok:
                    node._provision_and_sync()

            def log_message(self, *args):
                pass

        HTTPServer(('0.0.0.0', 8000), Handler).serve_forever()

    def _provision_and_sync(self):
        try:
            self.cloud.provisioned(self.wifi.connected_ssid or 'unknown')
            self._sync()
        except Exception as exc:
            self.get_logger().error(f'Provisioning failed: {exc}')

    def _sync(self):
        data = self.cloud.sync()
        cbm = data['cbm']
        path = os.path.join(DATA_DIR, 'building.cbm')
        with open(path, 'w') as fh:
            json.dump(cbm, fh)
        self.synced_version = cbm['version']
        msg = String()
        msg.data = path
        self.cbm_pub.publish(msg)
        self.get_logger().info(f'Synced building model v{cbm["version"]} → {path}')

    def _resync_check(self):
        if not self.wifi.is_connected():
            return
        try:
            data = self.cloud.sync()
            if data['cbm']['version'] != self.synced_version:
                self._sync()
        except Exception as exc:
            self.get_logger().warn(f'Resync failed: {exc}')


def main():
    rclpy.init()
    node = SyncNode()
    try:
        rclpy.spin(node)
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
