import React, {useState, useEffect, useCallback} from "react";
import { ScrollView, StatusBar, StyleSheet, View,Text, TextInput } from "react-native";
import FooterTab from "../component/FooterTab";
import { SettingScreenNavigationProp } from "../route/navigation-types";
import { colors } from "../styles/global";
import ExpandableCard from "../component/ExpandableCard";
import { Dropdown } from "react-native-element-dropdown";
import { saveSetting, readSetting } from '../utils/fileUtils';

type SettingScreenProps = {
    navigation: SettingScreenNavigationProp;
};

// 云同步平台
const cloudSyncPlatform = [
    { label: '坚果云', baseUrl: 'https://dav.jianguoyun.com/dav/' }
]
// 大模型
const bigModel = [
    { label: 'DeepSeek-V3', model: 'deepseek-v3', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions' }
]

const SettingScreen: React.FC<SettingScreenProps> = ({navigation}) => {
    // 云同步平台
    const [syncBaseUrl, setSyncBaseUrl] = useState<string>('');
    const [webdavFolder, onChangeWebdavFolder] = useState<string>('');
    const [webdavUser, onChangeWebdavUser] = useState<string>('');
    const [webdavPass, onChangeWebdavPass] = useState<string>('');
    // 大模型
    const [modelName, setModelName] = useState<string>('');
    const [modelBaseUrl, setModelBaseUrl] = useState<string>('');
    const [modelApi, onChangeModelApi] = useState<string>('');

    // 组件挂载时执行
    useEffect(() => {
        // 读取配置
        readSetting().then((setting) => {
            console.log(setting);
            if (setting) {
                setSyncBaseUrl(setting.WEBDAV_BASE_URL || '');
                onChangeWebdavFolder(setting.WEBDAV_FOLDER || '');
                onChangeWebdavUser(setting.WEBDAV_USER || '');
                onChangeWebdavPass(setting.WEBDAV_PASS || '');
                setModelName(setting.MODEL_NAME || '');
                setModelBaseUrl(setting.MODEL_BASE_URL || '');
                onChangeModelApi(setting.MODEL_API_KEY || '');
            }
        });
        // 组件卸载时执行
        return () => {};
    }, []);
    // 使用防抖机制，当配置发生变化时，延迟保存配置
    useEffect(() => {
        const timer = setTimeout(() => {
            saveSetting({
                WEBDAV_BASE_URL: syncBaseUrl,
                WEBDAV_FOLDER: webdavFolder,
                WEBDAV_USER: webdavUser,
                WEBDAV_PASS: webdavPass,
                MODEL_NAME: modelName,
                MODEL_BASE_URL: modelBaseUrl,
                MODEL_API_KEY: modelApi
            });
        }, 500);
        return () => {
            clearTimeout(timer);
        };
    }, [syncBaseUrl, webdavFolder, webdavUser, webdavPass, modelName, modelBaseUrl, modelApi]);

    // 返回首页
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
                    <ScrollView
                        style={styles.cardContainer}
                    >
                        <View style={styles.cardSection}>
                            <Text style={styles.cardTitle}>云同步</Text>
                            <ExpandableCard
                                title="平台设置"
                                style={{borderBottomEndRadius: 0, borderBottomStartRadius: 0}}
                                contentStyle={{gap: 20}}
                                svgPath="M5.703 6.042a.5.5 0 1 0-.406.914L9.5 8.824v3.382a5.5 5.5 0 0 1 1-1.481v-1.9l4.203-1.869a.5.5 0 1 0-.406-.914L10 7.952zM9.072 16.59q.191.075.39.12q.25.565.614 1.057a3.5 3.5 0 0 1-1.376-.25l-5.757-2.302A1.5 1.5 0 0 1 2 13.822V6.176a1.5 1.5 0 0 1 .943-1.392L8.7 2.48a3.5 3.5 0 0 1 2.6 0l5.757 2.303c.57.227.943.779.943 1.392v4.08a5.5 5.5 0 0 0-1-.657V6.176a.5.5 0 0 0-.314-.464L10.929 3.41a2.5 2.5 0 0 0-1.857 0L3.314 5.712A.5.5 0 0 0 3 6.176v7.646a.5.5 0 0 0 .314.465zM10 14.5a4.5 4.5 0 1 0 9 0a4.5 4.5 0 0 0-9 0m6.5-3a.5.5 0 0 1 .5.5v1.5a.5.5 0 0 1-.5.5H15a.5.5 0 1 1 0-1h.468a2 2 0 0 0-1.717-.105a2 2 0 0 0-.665.44a.5.5 0 1 1-.707-.707A3 3 0 0 1 16 12.152V12a.5.5 0 0 1 .5-.5m-.876 5.531A3 3 0 0 1 13 16.848V17a.5.5 0 1 1-1 0v-1.5a.5.5 0 0 1 .5-.5H14a.5.5 0 0 1 0 1h-.468q.075.04.155.077a2 2 0 0 0 2.227-.413a.5.5 0 0 1 .707.707a3 3 0 0 1-.997.66"
                            >
                                <View style={styles.cardView}>
                                    <Text style={styles.dropdownlabel}>云同步平台</Text>
                                    <Dropdown
                                        style={styles.dropdown}
                                        placeholderStyle={styles.placeholder}
                                        selectedTextStyle={styles.selectedText}
                                        data={cloudSyncPlatform}
                                        placeholder="选择使用的云同步平台"
                                        labelField={'label'}
                                        valueField={'baseUrl'}
                                        value={syncBaseUrl}
                                        onChange={(item) => setSyncBaseUrl(item.baseUrl)}
                                    />
                                </View>
                                <View style={styles.cardView}>
                                    <Text style={styles.inputLabel}>同步文件夹</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        onChangeText={onChangeWebdavFolder}
                                        value={webdavFolder}
                                    />
                                </View>
                            </ExpandableCard>
                            <ExpandableCard
                                title="用户设置"
                                style={{borderTopEndRadius: 0, borderTopStartRadius: 0}}
                                contentStyle={{gap: 20}}
                                svgPath="M12 12.5q-1.258 0-2.129-.871T9 9.5t.871-2.129T12 6.5t2.129.871T15 9.5t-.871 2.129T12 12.5m0-1q.817 0 1.409-.591Q14 10.317 14 9.5t-.591-1.409Q12.817 7.5 12 7.5t-1.409.591Q10 8.683 10 9.5t.591 1.409q.592.591 1.409.591m0 9.827l-8-4.885V7.558l8-4.885l8 4.885v8.884zm0-1.152l4.156-2.544q-.946-.547-2-.839Q13.105 16.5 12 16.5t-2.157.292t-1.999.839zm-5.12-3.142q1.155-.716 2.455-1.124T12 15.5t2.666.409q1.3.408 2.453 1.124L19 15.9V8.125L12 3.85L5 8.125V15.9zM12 12"
                            >
                                <View>
                                    <Text style={styles.inputLabel}>用户名</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        onChangeText={onChangeWebdavUser}
                                        value={webdavUser}
                                    />
                                </View>
                                <View>
                                    <Text style={styles.inputLabel}>密码</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        onChangeText={onChangeWebdavPass}
                                        value={webdavPass}
                                        secureTextEntry={true}
                                    />
                                </View>
                            </ExpandableCard>
                        </View>
                        <View style={styles.cardSection}>
                            <Text style={styles.cardTitle}>大模型API</Text>
                            <ExpandableCard
                                title="选择大语言模型"
                                style={{borderBottomEndRadius: 0, borderBottomStartRadius: 0}}
                                viewBox={32}
                                svgPath="M28.447 16.106L23 13.381V7a1 1 0 0 0-.553-.894l-6-3a1 1 0 0 0-.894 0l-6 3A1 1 0 0 0 9 7v6.382l-5.447 2.723A1 1 0 0 0 3 17v7a1 1 0 0 0 .553.895l6 3a1 1 0 0 0 .894 0L16 25.118l5.553 2.777a1 1 0 0 0 .894 0l6-3A1 1 0 0 0 29 24v-7a1 1 0 0 0-.553-.895M21 13.381l-4 2v-4.764l4-2Zm-5-8.264L19.764 7L16 8.882L12.236 7Zm-5 3.5l4 2v4.764l-4-2ZM9 25.382l-4-2v-4.764l4 2Zm1-6.5L6.236 17L10 15.118L13.764 17Zm1 1.736l4-2v4.764l-4 2Zm10 4.764l-4-2v-4.764l4 2Zm1-6.5L18.236 17L22 15.118L25.764 17Zm5 4.5l-4 2v-4.764l4-2Z"
                            >
                                <View style={styles.cardView}>
                                    <Text style={styles.dropdownlabel}>模型编号</Text>
                                    <Dropdown
                                        style={styles.dropdown}
                                        placeholderStyle={styles.placeholder}
                                        selectedTextStyle={styles.selectedText}
                                        data={bigModel}
                                        placeholder="选择使用的大模型"
                                        labelField={'label'}
                                        valueField={'model'}
                                        value={modelName}
                                        onChange={(item) => {setModelName(item.model);setModelBaseUrl(item.baseUrl);}}
                                    />
                                </View>
                            </ExpandableCard>
                            <ExpandableCard
                                title="API Key"
                                style={{borderTopEndRadius: 0, borderTopStartRadius: 0}}
                                viewBox={20}
                                svgPath="M15 6a1 1 0 1 1-2 0a1 1 0 0 1 2 0m-2.5-4C9.424 2 7 4.424 7 7.5c0 .397.04.796.122 1.175c.058.27-.008.504-.142.638l-4.54 4.54A1.5 1.5 0 0 0 2 14.915V16.5A1.5 1.5 0 0 0 3.5 18h2A1.5 1.5 0 0 0 7 16.5V16h1a1 1 0 0 0 1-1v-1h1a1 1 0 0 0 1-1v-.18c.493.134 1.007.18 1.5.18c3.076 0 5.5-2.424 5.5-5.5S15.576 2 12.5 2M8 7.5C8 4.976 9.976 3 12.5 3S17 4.976 17 7.5S15.024 12 12.5 12c-.66 0-1.273-.095-1.776-.347A.5.5 0 0 0 10 12.1v.9H9a1 1 0 0 0-1 1v1H7a1 1 0 0 0-1 1v.5a.5.5 0 0 1-.5.5h-2a.5.5 0 0 1-.5-.5v-1.586a.5.5 0 0 1 .146-.353l4.541-4.541c.432-.432.522-1.044.412-1.556A4.6 4.6 0 0 1 8 7.5"
                            >
                                <View style={styles.cardView}>
                                    <Text style={styles.inputLabel}>API Key</Text>
                                    <TextInput
                                        style={styles.textInput}
                                        onChangeText={onChangeModelApi}
                                        value={modelApi}
                                        secureTextEntry={true}
                                    />
                                </View>
                            </ExpandableCard>
                        </View>
                    </ScrollView>
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
    },
    cardContainer: {
        flex: 1,
    },
    cardSection: {
        padding: 10,
        flexDirection: 'column',
    },
    cardTitle: {
        fontSize: 13,
        color: colors.grey,
        marginLeft: 16,
        marginBottom: 8,
    },
    cardView: {
    },
    dropdownlabel: {
        position: 'absolute',
        color: colors.grey,
        backgroundColor: 'white',
        left: 22,
        top: -8,
        paddingHorizontal: 8,
        fontSize: 14,
        zIndex: 1,
    },
    dropdown: {
        height: 50,
        borderColor: colors.grey,
        borderWidth: 0.5,
        borderRadius: 8,
        paddingHorizontal: 16,
    },
    placeholder: {
        fontSize: 15,
        color: colors.grey,
    },
    selectedText: {
        fontSize: 15,
    },
    inputLabel: {
        position: 'absolute',
        color: colors.grey,
        backgroundColor: 'white',
        left: 22,
        top: -8,
        paddingHorizontal: 8,
        fontSize: 14,
        zIndex: 1,
    },
    textInput: {
        height: 50,
        borderColor: colors.grey,
        borderWidth: 0.5,
        borderRadius: 8,
        paddingHorizontal: 16,
    }
});

export default SettingScreen;