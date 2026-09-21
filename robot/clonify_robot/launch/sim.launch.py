"""Bring up a Gazebo Sim world from a synced Clonify building model.

Exports the building's .cbm (downloaded by sync_node to CLONIFY_ROBOT_DATA)
to an SDF world and launches Gazebo Sim (ros_gz) with it, so the same
building the client set up drives a physics simulation the ROS 2 robot
stack can train and test in — on the robot's OS. The autonomy nodes
(nav / perception / elevator / lock / telemetry) can then be run against
the simulated sensors exactly as on hardware (use --sim on drivers).

    ros2 launch clonify_robot sim.launch.py cbm:=/var/lib/clonify/building.cbm

Requires Gazebo Sim (gz-sim) and ros_gz installed on the machine. If those
are absent this still exports the world file so it can be loaded manually
(`gz sim <world.sdf>`) or imported into NVIDIA Isaac Sim (SDF import).
"""
import os

from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, ExecuteProcess, OpaqueFunction
from launch.substitutions import LaunchConfiguration


def _export_and_launch(context, *args, **kwargs):
    from clonify_robot.clonify_core.gazebo_world import export_file

    cbm = LaunchConfiguration('cbm').perform(context)
    world = LaunchConfiguration('world').perform(context)
    export_file(cbm, world)
    actions = []
    # Launch Gazebo Sim if available; otherwise the exported world remains
    # on disk for manual loading / Isaac import.
    if os.system('which gz > /dev/null 2>&1') == 0:
        actions.append(ExecuteProcess(cmd=['gz', 'sim', '-r', world], output='screen'))
    else:
        print(f'[clonify] Gazebo (gz) not found — exported world to {world}. '
              f'Load with `gz sim {world}` or import into Isaac Sim.')
    return actions


def generate_launch_description():
    data = os.environ.get('CLONIFY_ROBOT_DATA', '/var/lib/clonify')
    return LaunchDescription([
        DeclareLaunchArgument('cbm', default_value=os.path.join(data, 'building.cbm')),
        DeclareLaunchArgument('world', default_value=os.path.join(data, 'building.world.sdf')),
        OpaqueFunction(function=_export_and_launch),
    ])
