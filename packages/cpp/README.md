# Theia - Cpp Extension

This extension uses [Clangd](https://clang.llvm.org/extra/clangd.html) to
provide LSP features.

To install Clangd on Ubuntu 16.04:

    $ wget -O - https://apt.llvm.org/llvm-snapshot.gpg.key | sudo apt-key add -
    $ sudo echo "deb http://apt.llvm.org/xenial/ llvm-toolchain-xenial main" >  /etc/apt/sources.list.d/llvm.list
    $ sudo apt-get update && sudo apt-get install -y clang-tools-6.0
    $ sudo ln -s /usr/bin/clangd-6.0 /usr/bin/clangd

See [here](https://clang.llvm.org/extra/clangd.html#id4) for detailed installation instructions.

To get accurate diagnostics, it helps to...

1. ... have the build system of the C/C++ project generate a
   [`compile_commands.json`](https://clang.llvm.org/docs/JSONCompilationDatabase.html)
   file and...
2. ... point Clangd to the build directory

\#2 can be done in Theia by creating and selecting a [build
configuration](../languages/README.md) pointing to the build directory.


## License
[Apache-2.0](https://github.com/theia-ide/theia/blob/master/LICENSE)
