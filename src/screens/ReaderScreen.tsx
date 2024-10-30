import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, BackHandler, AppState, AppStateStatus } from 'react-native';
import { useRoute } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { Reader, useReader } from '@epubjs-react-native/core';
import { useFileSystem } from '@epubjs-react-native/file-system';
import { saveFile, readFileByPath, webdavGet, webdavUpload } from '../utils/fileUtils';
import { VolumeManager, VolumeResult } from 'react-native-volume-manager';
import { Buffer } from 'buffer';
import { useNavigation } from '@react-navigation/native';

const ReaderScreen = () => {
  type RouteParams = {
    bookId: string;
  };

  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: string; params: RouteParams }>();
  const { bookId } = route.params;
  const { goNext, goPrevious, getCurrentLocation } = useReader();
  // 当前应用状态
  const appState = useRef(AppState.currentState);
  // 保存书籍加载时的阅读进度
  const readerLocation = useRef<string | undefined>(undefined);
  // 初始音量
  const initialVolume = useRef<number>(0);
  // 用于存储上次调用的时间戳
  const lastVolumeChangeTime = useRef<number>(0); 
  // 节流间隔，单位为毫秒
  const THROTTLE_INTERVAL = 100; 

  useEffect(() => {
    // 加载书籍的信息
    loadBook();
    // 监听返回键事件
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    // 监听应用状态变化
    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    // 记录初始音量
    VolumeManager.getVolume().then(result => {
      initialVolume.current = result.volume;
    });

    // 禁用系统音量键的默认行为
    VolumeManager.showNativeVolumeUI({ enabled: false });

    // 监听音量键事件
    const volumeListener = VolumeManager.addVolumeListener(handleVolumeChange);

    return () => {
      // 移除监听器
      backHandler.remove();
      appStateListener.remove();
      volumeListener.remove();
    };
  }, []);

  // 处理返回键事件
  const handleBackPress = () => {
    // 保存阅读进度
    saveReaderLocation().then(() => {
      if(route.name === 'Reader') {
        // 返回HomeScreen
        navigation.goBack();
      }
    });
    return true;
  };

  // 处理应用状态变化
  const handleAppStateChange = (nextAppState: AppStateStatus) => { 
    if(nextAppState.match(/inactive|background/) && appState.current === 'active') {
      // 应用从前台切换到后台
      // 保存阅读进度
      saveReaderLocation();
    }else if(nextAppState === 'active' && appState.current.match(/inactive|background/)) {
      // 应用从后台切换到前台
      // 重新更新初始音量
      VolumeManager.getVolume().then(result => {
        initialVolume.current = result.volume;
      });
      console.log('应用从后台切换到前台');
    }
    appState.current = nextAppState;
  };

  // 处理音量变化
  const handleVolumeChange = (result: VolumeResult) => {
    console.log('音量变化', result.volume);
    const now = Date.now();
    if(now - lastVolumeChangeTime.current < THROTTLE_INTERVAL){
      // 节流
      // 重新将音量设置为初始音量
      VolumeManager.setVolume(initialVolume.current);
      return;
    }
    lastVolumeChangeTime.current = now; // 更新时间戳
    if(initialVolume.current === 0){
      // 初始音量为0
      if(result.volume > 0){
        goPrevious();
      }else{
        goNext();
      }
    }else{
      // 初始音量不为0
      if(result.volume > initialVolume.current){
        goPrevious();
      }else if(result.volume < initialVolume.current){
        goNext();
      }
    }
    // 重新将音量设置为初始音量
    VolumeManager.setVolume(initialVolume.current);
  };

  const loadBook = async () => {
    try {
      let bookConfigData;
      try {
        // 尝试获取云同步配置文件
        const cloudConfigData = await webdavGet(`${bookId}.json`);
        bookConfigData = Buffer.from(cloudConfigData);
        console.log('使用云同步配置文件');
      } catch (e) {
        // 获取云同步配置文件失败，使用本地配置文件
        const localConfigData = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.json`, 'utf8');
        bookConfigData = Buffer.from(localConfigData, 'utf8');
        console.log('使用本地配置文件');
      }
      const bookConfig = JSON.parse(bookConfigData.toString('utf8'));

      let bookData;
      try {
        // 尝试读取本地书籍信息
        bookData = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.epub`, 'base64');
        console.log('使用本地书籍信息');
      } catch (e) {
        // 读取本地书籍信息失败，尝试获取云同步文件的 EPUB 资源
        const cloudBookData = await webdavGet(`${bookId}.epub`);
        bookData = Buffer.from(cloudBookData).toString('base64');
        console.log('使用云同步书籍信息');

        // 将云同步文件复制到本地
        await RNFS.writeFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.epub`, bookData, 'base64');
        console.log('云同步书籍信息已复制到本地');
      }

      // 恢复阅读进度
      if (bookConfig.location) {
        readerLocation.current = bookConfig.location;
      }
    } catch (e) {
      console.log(e);
    }
  };

  const saveReaderLocation = async () => {
    // 获取当前阅读进度,包括cfi、进度百分比等信息
    const location = getCurrentLocation();
    // 获取本地配置文件
    const localConfigData = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.json`, 'utf8');
    const bookConfigData = Buffer.from(localConfigData, 'utf8');
    // 转换为JSON字符串
    const bookConfig = JSON.parse(bookConfigData.toString('utf8'));
    if (location) {
      if(bookConfig.location !== location.end.cfi){
        console.log('更新阅读进度');
      };
      // 更新阅读进度
      bookConfig.location = location.end.cfi;
      const jsonString = JSON.stringify(bookConfig);
      await saveFile(`${bookId}.json`, jsonString);
      await webdavUpload(`${bookId}.json`, jsonString);
    }
  };

  const prevPage = () => {
    goPrevious();
  };

  const nextPage = () => {
    goNext();
  };

  useEffect(() => {
  }, []);

  return (
    <View style={styles.container}>
      <Reader
        src={`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.epub`}
        flow='paginated'
        manager='continuous'
        fileSystem={useFileSystem}
        enableSwipe={false}
        width={Dimensions.get('window').width}
        height={Dimensions.get('window').height}
        initialLocation={readerLocation.current}
        allowScriptedContent={true}
        allowPopups={true}
      />
      <View style={styles.gestureArea}>
        <TouchableOpacity style={styles.gestureLeft} onPress={prevPage} />
        <TouchableOpacity style={styles.gestureCenter} onPress={() => console.log('打开菜单')} />
        <TouchableOpacity style={styles.gestureRight} onPress={nextPage} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  gestureArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    flexDirection: 'row',
  },
  gestureLeft: {
    flex: 1,
  },
  gestureCenter: {
    flex: 1,
  },
  gestureRight: {
    flex: 1,
  },
});

export default ReaderScreen;