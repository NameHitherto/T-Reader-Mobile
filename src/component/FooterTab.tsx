import React from "react";
import { StyleSheet, View, TouchableOpacity, Text } from "react-native";
import Svg, {Path} from 'react-native-svg';
import { colors } from "../styles/global";

interface FooterTabProps {
    activeTab: string; // 当前激活的标签
    onTabPress?: (key: string) => void; // 标签点击事件
}

const FooterTab: React.FC<FooterTabProps> = ({activeTab, onTabPress}) => {
    const tabs = [
        { key: 'home', text: '首页', path: 'M202.24 74C166.11 56.75 115.61 48.3 48 48a31.36 31.36 0 0 0-17.92 5.33A32 32 0 0 0 16 79.9V366c0 19.34 13.76 33.93 32 33.93c71.07 0 142.36 6.64 185.06 47a4.11 4.11 0 0 0 6.94-3V106.82a15.9 15.9 0 0 0-5.46-12A143 143 0 0 0 202.24 74m279.68-20.7A31.33 31.33 0 0 0 464 48c-67.61.3-118.11 8.71-154.24 26a143.3 143.3 0 0 0-32.31 20.78a15.93 15.93 0 0 0-5.45 12v337.13a3.93 3.93 0 0 0 6.68 2.81c25.67-25.5 70.72-46.82 185.36-46.81a32 32 0 0 0 32-32v-288a32 32 0 0 0-14.12-26.61' },
        { key: 'setting', text: '设置', path: 'M256 176a80 80 0 1 0 80 80a80.24 80.24 0 0 0-80-80m172.72 80a165.5 165.5 0 0 1-1.64 22.34l48.69 38.12a11.59 11.59 0 0 1 2.63 14.78l-46.06 79.52a11.64 11.64 0 0 1-14.14 4.93l-57.25-23a176.6 176.6 0 0 1-38.82 22.67l-8.56 60.78a11.93 11.93 0 0 1-11.51 9.86h-92.12a12 12 0 0 1-11.51-9.53l-8.56-60.78A169.3 169.3 0 0 1 151.05 393L93.8 416a11.64 11.64 0 0 1-14.14-4.92L33.6 331.57a11.59 11.59 0 0 1 2.63-14.78l48.69-38.12A175 175 0 0 1 83.28 256a165.5 165.5 0 0 1 1.64-22.34l-48.69-38.12a11.59 11.59 0 0 1-2.63-14.78l46.06-79.52a11.64 11.64 0 0 1 14.14-4.93l57.25 23a176.6 176.6 0 0 1 38.82-22.67l8.56-60.78A11.93 11.93 0 0 1 209.94 26h92.12a12 12 0 0 1 11.51 9.53l8.56 60.78A169.3 169.3 0 0 1 361 119l57.2-23a11.64 11.64 0 0 1 14.14 4.92l46.06 79.52a11.59 11.59 0 0 1-2.63 14.78l-48.69 38.12a175 175 0 0 1 1.64 22.66' },
    ]

    return (
        <View style={styles.container}>
            {tabs.map((tab) => (
                <TouchableOpacity
                    key={tab.key}
                    onPress={() => onTabPress && onTabPress(tab.key)}
                >
                    <View style={styles.tab}>
                        <Svg
                            width={28}
                            height={28}
                            viewBox="0 0 512 512"
                        >
                            <Path 
                                d={tab.path}
                                fill={activeTab === tab.key ? colors.iconActive : 'none'}
                                stroke={colors.iconStroke}
                                strokeWidth={activeTab === tab.key ? 0 : 36}
                            />
                        </Svg>
                        <Text style={styles.tabText}>{tab.text}</Text>
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        display: 'flex',
        width: '100%',
        height: 55,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0 0 6px rgba(0, 0, 0, 0.1)',
        backgroundColor: '#fff',
    },
    tab: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        width: 80,
    },
    tabText: {
        textAlign: 'center',
        fontSize: 12,
    }
});

export default FooterTab;