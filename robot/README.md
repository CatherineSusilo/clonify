# Clonify Robot Stack (ROS 2)

ROS 2 (Humble+) workspace for the Clonify autonomous indoor delivery unit.
The website/cloud (`server/`, `web/`) and the robot stack are separate
systems; they share only the **CBM building model format**
(`docs/CBM_FORMAT.md`) and the cloud robot API (`server/src/routes/robots.js`).

## Packages

- **`clonify_robot`** — all onboard nodes:

| Node | Purpose |
|---|---|
| `sync_node` | Wi-Fi provisioning (setup hotspot → building Wi-Fi), pairing with the unit code printed on the chassis, `.cbm` model + elevator profile download, command polling |
| `nav_node` | Global planning — Dijkstra over the CBM nav graph — plus waypoint following and dynamic local re-routes |
| `perception_node` | OpenCV obstacle avoidance (depth + RGB), incident classification (INFO/WARN/CRIT) |
| `elevator_node` | Multi-floor operation: vertical mast extension, floor-indicator OCR through the camera, 20-key pneumatic actuator button pressing, single/double-door handling |
| `lock_node` | Secure compartment lock — PIN/QR credential forwarding, signed unlock-token verification, retrieval confirmation |
| `telemetry_node` | Pose/battery/status reporting to the cloud; receives dispatch routes |

`clonify_core/` inside the package is plain Python (no ROS imports): the CBM
parser, Dijkstra implementation and elevator profile model — unit-testable
without a ROS install (`python3 -m pytest robot/clonify_robot/test`).

## Generic vs. building-specific

Identical on every unit (generic): navigation, obstacle avoidance, the best-
route delivery algorithm, the lock system, telemetry, incident detection.

Building-specific (loaded from the synced `.cbm` + elevator profiles, set up
manually by the client during building setup): elevator key layout and
mapping, panel/call-button heights the mast must reach, door type
(single/double), elevator count and map locations.

## First-boot / building setup flow

1. Client pairs the unit in the dashboard using the printed code.
2. Robot boots with no Wi-Fi → `sync_node` starts the `CLONIFY-SETUP-<code>`
   hotspot and a captive portal (port 8000) asking for the **building Wi-Fi**
   credentials. Setup for the building cannot complete until this succeeds.
3. Robot joins the building network, calls `POST /api/robot/<code>/provisioned`,
   then downloads the building model via `GET /api/robot/<code>/sync`.
4. Unit goes `idle` at the charging area and accepts dispatches.

## Build & run

```bash
cd robot
colcon build --symlink-install
source install/setup.bash
ros2 launch clonify_robot robot.launch.py code:=CLNF-XXXXXXXX
```

Hardware-free development: every hardware driver (motors, mast, actuator,
lock solenoids, Wi-Fi) has a `--sim` mode that logs actuation instead of
driving GPIO/CAN, so the full stack runs on a laptop against the cloud API.

## Physics simulation the robot can train from (Gazebo / Isaac)

The web app's simulation is a lightweight preview for clients. For a sim a
real robot can **train and be validated in**, the same building model is
exported to a physics world:

- `clonify_core/gazebo_world.py` (`world_export` console script) converts a
  synced `.cbm` into an **SDF world** for **Gazebo Sim** (formerly Ignition)
  — floors as ground planes at their real elevation, blueprint walls
  extruded as static collision geometry. Gazebo is the standard open-source
  robotics simulator and integrates with ROS 2 via `ros_gz`, so the world
  runs on a laptop or on the robot's own compute.

  ```bash
  # export only
  world_export /var/lib/clonify/building.cbm building.world.sdf
  gz sim building.world.sdf
  # export + launch Gazebo + (optionally) the autonomy stack
  ros2 launch clonify_robot sim.launch.py cbm:=/var/lib/clonify/building.cbm
  ```

  The autonomy nodes (`nav`/`perception`/`elevator`/`lock`/`telemetry`) run
  against the simulated LiDAR/depth sensors exactly as on hardware, so
  navigation and obstacle-avoidance policies can be exercised and trained
  before deployment.

- **NVIDIA Isaac Sim**: Isaac imports SDF/URDF directly, so the same
  exported world loads there for higher-fidelity, GPU-accelerated,
  domain-randomised training. The exported SDF is the bridge; point Isaac
  Sim's SDF importer at `building.world.sdf`.

Because the world is generated from the client's real building, every
deployment gets a matching digital twin to train and regression-test in.
