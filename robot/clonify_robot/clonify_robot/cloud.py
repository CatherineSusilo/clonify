"""HTTP client for the Clonify cloud robot API (server/src/routes/robots.js).

Authenticates every call with the unit code + API key issued at pairing."""
from __future__ import annotations

import json
import urllib.request


class CloudClient:
    def __init__(self, base_url: str, code: str, api_key: str, timeout: float = 10.0):
        self.base_url = base_url.rstrip('/')
        self.code = code
        self.api_key = api_key
        self.timeout = timeout

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        url = f'{self.base_url}/api/robot/{self.code}{path}'
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers={
            'Content-Type': 'application/json',
            'X-Robot-Key': self.api_key,
        })
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode() or '{}')

    def provisioned(self, ssid: str) -> dict:
        return self._request('POST', '/provisioned', {'ssid': ssid})

    def sync(self) -> dict:
        return self._request('GET', '/sync')

    def telemetry(self, pose: dict) -> dict:
        """Returns {'commands': [...]} — dispatch routes piggyback on telemetry."""
        return self._request('POST', '/telemetry', pose)

    def delivery_status(self, delivery_id: int, status: str) -> dict:
        return self._request('POST', f'/delivery/{delivery_id}/status', {'status': status})

    def incident(self, severity: str, kind: str, detail: dict) -> dict:
        return self._request('POST', '/incident', {'severity': severity, 'kind': kind, 'detail': detail})

    def request_unlock(self, delivery_id: int, pin: str | None = None, qr_token: str | None = None) -> dict:
        url = f'{self.base_url}/api/deliveries/{delivery_id}/unlock'
        body = {'pin': pin} if pin else {'qrToken': qr_token}
        body['code'] = self.code
        data = json.dumps(body).encode()
        req = urllib.request.Request(url, data=data, method='POST', headers={
            'Content-Type': 'application/json', 'X-Robot-Key': self.api_key,
        })
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode())

    def complete_delivery(self, delivery_id: int) -> dict:
        url = f'{self.base_url}/api/deliveries/{delivery_id}/complete'
        req = urllib.request.Request(url, data=json.dumps({'code': self.code}).encode(), method='POST', headers={
            'Content-Type': 'application/json', 'X-Robot-Key': self.api_key,
        })
        with urllib.request.urlopen(req, timeout=self.timeout) as resp:
            return json.loads(resp.read().decode())
