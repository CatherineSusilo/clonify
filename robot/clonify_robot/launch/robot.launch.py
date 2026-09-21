from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, SetEnvironmentVariable
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    code = LaunchConfiguration('code')
    cloud_url = LaunchConfiguration('cloud_url')
    api_key = LaunchConfiguration('api_key')
    sim = LaunchConfiguration('sim')

    def unit(executable):
        return Node(
            package='clonify_robot',
            executable=executable,
            output='screen',
            parameters=[{
                'code': code,
                'cloud_url': cloud_url,
                'api_key': api_key,
                'sim': sim,
            }],
        )

    return LaunchDescription([
        DeclareLaunchArgument('code', description='Unit code printed on the chassis'),
        DeclareLaunchArgument('cloud_url', default_value='https://app.clonify.ca'),
        DeclareLaunchArgument('api_key', default_value=''),
        DeclareLaunchArgument('sim', default_value='false'),
        SetEnvironmentVariable('CLONIFY_SIM', sim),
        unit('sync_node'),
        unit('telemetry_node'),
        unit('nav_node'),
        unit('perception_node'),
        unit('elevator_node'),
        unit('lock_node'),
    ])
