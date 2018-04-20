# Theia - Languages Extension

Among other things, the languages extension provides the building blocks for
interacting with language servers.

It also provides a facility to describe build configurations, which are useful
for languages that can have multiple builds (configured differently) for the
same source.  Selecting a different active build configuration may influence
how the code is analyzed by the language server, and therefore change the
diagnostics.

Build configurations are described by placing a `.theia/builds.json` file in
the workspace:

    {
      "builds": [
        {
          "name": "My debug build",
          "directory": "/tmp/cpp-test/build-debug"
        },
        {
          "name": "My release build",
          "directory": "../build-release"
        }
      ]
    }

Each build object may contain the following attributes:

* name: Name of the build.
* directory: Path to the build directory.  It can be absolute or relative to
  the workspace.

The user can change the active build configuration with the "Change Build
Configuration" item in the command palette.

## License
[Apache-2.0](https://github.com/theia-ide/theia/blob/master/LICENSE)
