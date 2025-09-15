# T-Reader-Mobile
这是一个基于[**React Native**](https://reactnative.dev)框架开发的T-Reader移动端项目。PC端项目为[T-Reader](https://github.com/NameHitherto/T-Reader.git)。

## 技术栈
`React` + `TypeScript`

## 开发
>**注意**: 首先确保你已完成React Native中的[环境搭建](https://reactnative.cn/docs/environment-setup)环节。
本项目使用的`Java`版本是**17.0.16-oracle**,`node`版本为**22.17.1**,`React Native`版本为**0.76**,`@dr.pogodin/react-native-fs`版本为**2.30.3**。

>**注意**: 以下所有命令默认都在项目根目录下运行。
1. 安装Yarn，`npm install -g yarn`，运行`npm install -g react-native-cli`。
2. 安装项目依赖，运行`npm install`或`yarn install`安装依赖。
3. 安装Android依赖，运行`cd android && gradlew clean`清理构建缓存。
4. 运行项目，使用`yarn react-native run-android`或`yarn android`在模拟机上调试,使用`npx react-native run-android`在安卓设备上调试。
5. 生成发行APK包，`cd android && ./gradlew assembleRelease`，打包详见[Android打包发布](https://reactnative.cn/docs/0.76/signed-apk-android)。