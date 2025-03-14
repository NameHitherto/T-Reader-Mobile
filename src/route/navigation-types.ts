import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";

// 定义应用中所有路由的参数类型
export type RootStackParamList = {
    Home: undefined;
    Reader: { bookId: string };
    Setting: undefined;
};

// 为每个屏幕导出导航和路由类型
export type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;
export type ReaderScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Reader'>;
export type SettingScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Setting'>;

export type ReaderScreenRouteProp = RouteProp<RootStackParamList, 'Reader'>;