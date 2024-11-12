import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions, BackHandler, AppState, AppStateStatus, Text } from 'react-native';
import { useRoute } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { Reader, useReader } from '@epubjs-react-native/core';
import { useFileSystem } from '@epubjs-react-native/file-system';
import { saveFile, webdavGet, webdavUpload } from '../utils/fileUtils';
import { Buffer } from 'buffer';
import { useNavigation } from '@react-navigation/native';
import { getKeyCode, setKeyCode} from '../utils/VolumeModule';
import Modal from 'react-native-modal';
import LoadingAnimation, {AnimationType} from '../component/LoadingAnimation';

const ReaderScreen = () => {
  // 菜单弹窗是否显示
  const [isModalVisible, setIsModalVisible] = useState(false);
  const toggleModal = () => setIsModalVisible(!isModalVisible);

  // 阅读器样式设置
  const [readerStyle, setReaderStyle] = useState({
    backgroundColor: '#ffffff',
    color: '#000000',
  });

  // 当 readerStyle 发生变化时应用变化，并在组件销毁时保存到本地文件
  useEffect(() => {
    applyReaderStyle();
    return () => {
      saveReaderStyle();
    };
  }, [readerStyle]);

  type RouteParams = {
    bookId: string;
  };
  const navigation = useNavigation();
  const route = useRoute<{ key: string; name: string; params: RouteParams }>();
  const { bookId } = route.params;
  const { goNext, goPrevious, getCurrentLocation, goToLocation, changeTheme } = useReader();
  // 保存书籍加载时的阅读进度
  const readerLocation = useRef<string | undefined>(undefined);
  // 节流间隔，单位为毫秒
  const THROTTLE_INTERVAL = 100;
  // 加载条样式
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingType, setLoadingType] = useState<AnimationType>('roxy');
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  useEffect(() => {
    // 启动加载条
    setLoadingType('book');
    setLoadingMessage('加载书籍中...');
    setLoading(true);
    // 加载书籍的信息
    loadBook();
    // 加载阅读器样式设置
    loadReaderStyle();
    // 监听返回键事件
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);

    // 监听应用状态变化
    const appStateListener = AppState.addEventListener('change', handleAppStateChange);

    // 定时监听音量键事件
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
        prevPage();
      } else if (keyCode === 25) {
        // 音量键下
        nextPage();
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
  const handleAppStateChange = async (nextAppState: AppStateStatus) => { 
    if(nextAppState.match(/inactive|background/)) {
      // 应用从前台切换到后台
      console.log('应用从前台切换到后台');
      // 保存阅读进度
      await saveReaderLocation();
    }else if(nextAppState === 'active') {
      // 应用从后台切换到前台
      console.log('应用从后台切换到前台');
    }
  };

  // 处理翻页/阅读位置变化
  const handleLocationChanged = () => {
    // 更新阅读位置
    const location = getCurrentLocation()?.end.cfi;
    readerLocation.current = location;
    // 更新阅读百分比等信息
  };

  // 处理阅读器加载完成
  const handleLocationReady = () => {
    // 阅读器加载完成，跳转到指定位置
    if (readerLocation.current) {
      goToLocation(readerLocation.current);
    }else{
      // loadBook还未完成，进度还没加载
      loadBook().then(() => {
        if(readerLocation.current){
          goToLocation(readerLocation.current);
        }
      });
    }
    // 恢复阅读器样式,后续可以考虑在阅读器加载的更早时机触发
    applyReaderStyle();
  };

  const loadBook = async () => {
    console.log('loadBooking', bookId);
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

      // 恢复阅读进度
      if (bookConfig.location) {
        readerLocation.current = bookConfig.location;
      }

      if(!await RNFS.exists(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.epub`)) {
        // 本地不存在该书籍文件，尝试下载云同步文件
        const cloudBookData = await webdavGet(`${bookId}.epub`);
        const bookData = Buffer.from(cloudBookData).toString('base64');
        // 将云同步文件复制到本地
        await RNFS.writeFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.epub`, bookData, 'base64');
      }
    } catch (e) {
      console.log(e);
    }
  };

  const saveReaderLocation = async () => {
    // 获取本地配置文件
    const localConfigData = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/T-Reader/${bookId}.json`, 'utf8');
    const bookConfigData = Buffer.from(localConfigData, 'utf8');
    // 转换为JSON字符串
    const bookConfig = JSON.parse(bookConfigData.toString('utf8'));
    if (readerLocation.current) {
      // 更新阅读进度
      bookConfig.location = readerLocation.current;
      const jsonString = JSON.stringify(bookConfig);
      await webdavUpload(`${bookId}.json`, jsonString);
      await saveFile(`${bookId}.json`, jsonString);
    }
  };

  // 保存阅读器样式设置到本地文件
  const saveReaderStyle = async () => {
    const jsonString = JSON.stringify(readerStyle);
    await RNFS.writeFile(`${RNFS.DocumentDirectoryPath}/ReaderConfig.json`, jsonString, 'utf8');
  };

  // 加载阅读器样式设置
  const loadReaderStyle = async () => {
    try {
      const configData = await RNFS.readFile(`${RNFS.DocumentDirectoryPath}/ReaderConfig.json`, 'utf8');
      const config = JSON.parse(configData);
      setReaderStyle(config);
    } catch (e) {
      console.log('未找到本地配置文件，使用默认样式');
    }
  };

  // 应用阅读器样式
  const applyReaderStyle = () => {
    changeTheme({
      body: {
        background: readerStyle.backgroundColor,
      },
      p: {
        color: readerStyle.color,
      }
    });
  };

  const prevPage = () => {
    goPrevious();
  };

  const nextPage = () => {
    goNext();
  };

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
        allowScriptedContent={true}
        allowPopups={true}
        onLocationsReady={handleLocationReady}
        onLocationChange={handleLocationChanged}
        renderOpeningBookComponent={() => 
          <LoadingAnimation 
            isVisible={loading} 
            onBackdropPress={() => {console.log('loading...')}} 
            animationType={loadingType} 
            message={loadingMessage}
          />
        }
        renderLoadingFileComponent={() => 
          <LoadingAnimation 
            isVisible={loading} 
            onBackdropPress={() => {console.log('loading...')}} 
            animationType={loadingType} 
            message={loadingMessage}
          />
        }
      />
      <View style={styles.gestureArea}>
        <TouchableOpacity style={styles.gestureLeft} onPress={prevPage} />
        <TouchableOpacity style={styles.gestureCenter} onPress={toggleModal} />
        <TouchableOpacity style={styles.gestureRight} onPress={nextPage} />
      </View>
      <Modal
        isVisible={isModalVisible}
        onBackdropPress={toggleModal}
        onBackButtonPress={toggleModal}
        style={styles.modal}
        backdropOpacity={0}
        animationIn={'fadeInUp'}
        animationInTiming={350}
        animationOut={'slideOutDown'}
        animationOutTiming={350}
      >
        <View style={styles.modalContent}>
          <View style={styles.colorOptions}>
            <Text style={styles.menuTitle}>主题</Text>
            <TouchableOpacity
              style={[styles.colorButton, { backgroundColor: '#ffffff' }]}
              onPress={() => setReaderStyle({ backgroundColor: '#ffffff', color: '#000000' })}
            />
            <TouchableOpacity
              style={[styles.colorButton, { backgroundColor: '#faebd7' }]}
              onPress={() => setReaderStyle({ backgroundColor: '#faebd7', color: '#000000' })}
            />
            <TouchableOpacity
              style={[styles.colorButton, { backgroundColor: '#000000' }]}
              onPress={() => setReaderStyle({ backgroundColor: '#000000', color: '#ffffff' })}
            />
          </View>
        </View>
      </Modal>
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
  modal:{
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#91d5ff',
    padding: 20,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  colorOptions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  colorButton: {
    width: 35,
    height: 35,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#000',
  },
});

export default ReaderScreen;