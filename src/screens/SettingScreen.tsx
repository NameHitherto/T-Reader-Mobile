import React from "react";
import { StatusBar, StyleSheet, View } from "react-native";
import FooterTab from "../component/FooterTab";
import { SettingScreenNavigationProp } from "../route/navigation-types";
import { colors } from "../styles/global";

type SettingScreenProps = {
    navigation: SettingScreenNavigationProp;
};

const SettingScreen: React.FC<SettingScreenProps> = ({navigation}) => {
    const goHome = (key: string) => {
        if (key === 'home') {
           navigation.navigate("Home"); 
        }
    };

    return (
        <>
            <StatusBar 
                backgroundColor={colors.lightSlate}
            />
            <View style={styles.container}>
                <View style={styles.header}>

                </View>
                <View style={styles.body}>

                </View>
                <FooterTab 
                    activeTab="setting"
                    onTabPress={(key) => goHome(key)}
                />
            </View>
        </>
    )
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',  
    },
    header: {
        backgroundColor: colors.lightSlate,
    },
    body: {
        flex: 1,
        backgroundColor: colors.lightSlate,
    }
});

export default SettingScreen;