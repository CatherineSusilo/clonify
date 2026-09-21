from setuptools import find_packages, setup

package_name = 'clonify_robot'

setup(
    name=package_name,
    version='1.0.0',
    packages=find_packages(exclude=['test']),
    data_files=[
        ('share/ament_index/resource_index/packages', ['resource/' + package_name]),
        ('share/' + package_name, ['package.xml']),
        ('share/' + package_name + '/launch', ['launch/robot.launch.py', 'launch/sim.launch.py']),
        ('share/' + package_name + '/config', ['config/robot.yaml']),
    ],
    install_requires=['setuptools'],
    zip_safe=True,
    maintainer='Clonify Inc.',
    maintainer_email='mail@clonify.ca',
    description='Clonify autonomous indoor delivery unit stack',
    license='Proprietary',
    entry_points={
        'console_scripts': [
            'sync_node = clonify_robot.sync_node:main',
            'nav_node = clonify_robot.nav_node:main',
            'perception_node = clonify_robot.perception_node:main',
            'elevator_node = clonify_robot.elevator_node:main',
            'lock_node = clonify_robot.lock_node:main',
            'telemetry_node = clonify_robot.telemetry_node:main',
            'world_export = clonify_robot.clonify_core.gazebo_world:main',
        ],
    },
)
