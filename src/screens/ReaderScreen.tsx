import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, BackHandler, AppState, AppStateStatus, NativeModules, NativeEventEmitter, DeviceEventEmitter, NativeAppEventEmitter } from 'react-native';
import { useRoute } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { Reader, useReader } from '@epubjs-react-native/core';
import { useFileSystem } from '@epubjs-react-native/file-system';
import { saveFile, webdavGet, webdavUpload } from '../utils/fileUtils';
import { Buffer } from 'buffer';
import { useNavigation } from '@react-navigation/native';
import { getKeyCode, setKeyCode} from '../utils/VolumeModule';

const ReaderScreen = () => {
  type RouteParams = {
    bookId: string;
  };
  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: string; params: RouteParams }>();
  const { bookId } = route.params;
  const { goNext, goPrevious, getCurrentLocation, goToLocation, isLoading } = useReader();
  // 当前应用状态
  const appState = useRef(AppState.currentState);
  // 保存书籍加载时的阅读进度
  const readerLocation = useRef<string | undefined>(undefined);
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

    // 监听音量键事件
    const keyCodeInterval = setInterval(handleVolumeKeyPress, THROTTLE_INTERVAL);

    return () => {
      // 移除监听器
      backHandler.remove();
      appStateListener.remove();
      // 清除定时器
      clearInterval(keyCodeInterval);
    };
  }, []);

  // 处理物理按键(音量键)事件
  const handleVolumeKeyPress = () => {
    getKeyCode().then((keyCode) => {
      if (keyCode === 24) {
        // 音量键上
        goPrevious();
      } else if (keyCode === 25) {
        // 音量键下
        goNext();
      }
      setKeyCode(0);
    });
  };

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
    }
    appState.current = nextAppState;
  };

  const loadBook = async () => {
    console.log('加载书籍', bookId);
    try {
      let bookConfigData;
      try {
        // 尝试获取云同步配置文件
        const cloudConfigData = await webdavGet(`${bookId}.json`);
        bookConfigData = Buffer.from(cloudConfigData);
      } catch (e) {
        // 获取云同步配置文件失败，使用本地配置文件
        const localConfigData = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.json`, 'utf8');
        bookConfigData = Buffer.from(localConfigData, 'utf8');
      }
      const bookConfig = JSON.parse(bookConfigData.toString('utf8'));

      let bookData;
      try {
        // 尝试读取本地书籍信息
        bookData = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.epub`, 'base64');
      } catch (e) {
        // 读取本地书籍信息失败，尝试获取云同步文件的 EPUB 资源
        const cloudBookData = await webdavGet(`${bookId}.epub`);
        bookData = Buffer.from(cloudBookData).toString('base64');

        // 将云同步文件复制到本地
        await RNFS.writeFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.epub`, bookData, 'base64');
      }

      // 恢复阅读进度
      if (bookConfig.location) {
        readerLocation.current = bookConfig.location;
        // 若阅读器已经加载完成
        if (!isLoading) {
          goToLocation(bookConfig.location);
        }
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
      // 更新阅读进度
      bookConfig.location = location.end.cfi;
      const jsonString = JSON.stringify(bookConfig);
      await webdavUpload(`${bookId}.json`, jsonString);
      await saveFile(`${bookId}.json`, jsonString);
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