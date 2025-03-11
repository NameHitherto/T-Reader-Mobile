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
import LoadingAnimation from '../component/LoadingAnimation';
import Svg, { Path } from 'react-native-svg';
import Slider from '@react-native-community/slider';

const ReaderScreen = () => {
  // 菜单弹窗是否显示
  const [isModalVisible, setIsModalVisible] = useState(false);
  const toggleModal = () => setIsModalVisible(!isModalVisible);

  // 目录抽屉状态
  const [isTocVisible, setIsTocVisible] = useState(false);
  const toggleToc = () => setIsTocVisible(!isTocVisible);

  // 样式抽屉状态
  const [isStyleVisible, setIsStyleVisible] = useState(false);
  const toggleStyle = () => {
    setIsStyleVisible(!isStyleVisible);
    // 若菜单弹窗显示，则关闭菜单弹窗
    if(isModalVisible) {
      setIsModalVisible(false);
    }
  };

  // 阅读器样式设置
  const [readerStyle, setReaderStyle] = useState({
    backgroundColor: '#ffffff',
    color: '#000000',
    fontSize: 16,
    textIndent: 0,
    padding: 10,
    lineHeight: 1.5,
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
  const { goNext, goPrevious, getCurrentLocation, goToLocation, changeTheme, changeFontSize } = useReader();
  // 保存书籍加载时的阅读进度
  const readerLocation = useRef<string | undefined>(undefined);
  // 节流间隔，单位为毫秒
  const THROTTLE_INTERVAL = 100;

  useEffect(() => {
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
    changeFontSize(`${readerStyle.fontSize}px`);
    changeTheme({
      body: {
        'background': `${readerStyle.backgroundColor}`,
        'padding': `${readerStyle.padding}px`,
      },
      p: {
        'color': `${readerStyle.color}`,
        'text-indent': `${readerStyle.textIndent}em`,
        'line-height': `${readerStyle.lineHeight}em`,
      }
    });
  };

  const prevPage = () => {
    goPrevious();
  };

  const nextPage = () => {
    goNext();
  };

  // 调整样式
  const handleFontSizeChange = (value: number) => {
    setReaderStyle(prev => ({ ...prev, fontSize: value }));
  };

  const handleTextIndentChange = (value: number) => {
    setReaderStyle(prev => ({ ...prev, textIndent: value }));
  };

  const handlePaddingChange = (value: number) => {
    setReaderStyle(prev => ({ ...prev, padding: value }));
  };

  const handleLineHeightChange = (value: number) => {
    setReaderStyle(prev => ({ ...prev, lineHeight: value }));
  };

  // 精度修正函数
  const roundToStep = (value: number, step: number): number => {
    const factor = 1 / step;
    return Math.round(value * factor) / factor;
  };

  // 增加样式值
  const incrementStyle = (styleKey: keyof typeof readerStyle, step: number, max: number) => {
    setReaderStyle(prev => {
      const newValue = roundToStep(Math.min(Number(prev[styleKey]) + step, max), step);
      return { ...prev, [styleKey]: newValue };
    });
  };

  // 减少样式值
  const decrementStyle = (styleKey: keyof typeof readerStyle, step: number, min: number) => {
    setReaderStyle(prev => {
      const newValue = roundToStep(Math.max(Number(prev[styleKey]) - step, min), step);
      return { ...prev, [styleKey]: newValue };
    });
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
            isVisible={true} 
            onBackdropPress={() => {console.log('loading...')}} 
            animationType={"book"} 
          />
        }
        renderLoadingFileComponent={() => 
          <LoadingAnimation 
            isVisible={true} 
            onBackdropPress={() => {console.log('loading...')}} 
            animationType={"book"} 
          />
        }
      />
      <View style={styles.gestureArea}>
        <TouchableOpacity style={styles.gestureLeft} onPress={prevPage} />
        <TouchableOpacity style={styles.gestureCenter} onPress={toggleModal} />
        <TouchableOpacity style={styles.gestureRight} onPress={nextPage} />
      </View>
      {/* 菜单 */}
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
              onPress={() => setReaderStyle({...readerStyle, backgroundColor: '#ffffff', color: '#000000' })}
            />
            <TouchableOpacity
              style={[styles.colorButton, { backgroundColor: '#faebd7' }]}
              onPress={() => setReaderStyle({...readerStyle, backgroundColor: '#faebd7', color: '#000000' })}
            />
            <TouchableOpacity
              style={[styles.colorButton, { backgroundColor: '#000000' }]}
              onPress={() => setReaderStyle({...readerStyle, backgroundColor: '#000000', color: '#ffffff' })}
            />
          </View>
          <View style={styles.menuRow}>
            <TouchableOpacity style={styles.iconButton} onPress={toggleToc}>
              <Svg width="32" height="32" viewBox="0 0 24 24">
                <Path d="M4 17q-.425 0-.712-.288T3 16t.288-.712T4 15h12q.425 0 .713.288T17 16t-.288.713T16 17zm0-4q-.425 0-.712-.288T3 12t.288-.712T4 11h12q.425 0 .713.288T17 12t-.288.713T16 13zm0-4q-.425 0-.712-.288T3 8t.288-.712T4 7h12q.425 0 .713.288T17 8t-.288.713T16 9zm16 8q-.425 0-.712-.288T19 16t.288-.712T20 15t.713.288T21 16t-.288.713T20 17m0-4q-.425 0-.712-.288T19 12t.288-.712T20 11t.713.288T21 12t-.288.713T20 13m0-4q-.425 0-.712-.288T19 8t.288-.712T20 7t.713.288T21 8t-.288.713T20 9"/>
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={toggleStyle}>
              <Svg width="32" height="32" viewBox="0 0 24 24">
                <Path fillRule='evenodd' d="M13 21v-8h8v8zm2-6h4v4h-4zM3 11V3h8v8zm2-6h4v4H5z" clip-rule="evenodd"/><Path d="M18 6v6h-2V8h-4V6zm-6 12H6v-6h2v4h4z"/>
              </Svg>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* 样式抽屉 */}
      <Modal
        isVisible={isStyleVisible}
        onBackdropPress={toggleStyle}
        onBackButtonPress={toggleStyle}
        style={styles.styleModal}
        animationIn={'zoomIn'}
        animationInTiming={300}
        animationOut={'zoomOut'}
        animationOutTiming={300}
        backdropOpacity={0}
      >
        <View style={styles.styleContent}>
          {/* 字体大小 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelContainer}>
              <Text style={styles.sliderLabel}>字体大小</Text>
              <Text style={styles.sliderValue}>{readerStyle.fontSize}</Text>
              <View style={styles.controlButton}>
                <TouchableOpacity 
                  onPress={() => decrementStyle('fontSize', 1, 12)} 
                >
                  <Text style={styles.controlButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => incrementStyle('fontSize', 1, 24)} 
                >
                  <Text style={styles.controlButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.sliderControl}>
              <Slider
                style={styles.slider}
                minimumValue={12}
                maximumValue={24}
                step={1}
                value={readerStyle.fontSize}
                onValueChange={handleFontSizeChange}
                minimumTrackTintColor="#1EB1FC"
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor="#1EB1FC"
              />
            </View>
          </View>

          {/* 首行缩进 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelContainer}>
              <Text style={styles.sliderLabel}>首行缩进</Text>
              <Text style={styles.sliderValue}>{readerStyle.textIndent}em</Text>
              <View style={styles.controlButton}>
                <TouchableOpacity 
                  onPress={() => decrementStyle('textIndent', 1, 0)} 
                >
                  <Text style={styles.controlButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => incrementStyle('textIndent', 1, 30)} 
                >
                  <Text style={styles.controlButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.sliderControl}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={30}
                step={1}
                value={readerStyle.textIndent}
                onValueChange={handleTextIndentChange}
                minimumTrackTintColor="#1EB1FC"
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor="#1EB1FC"
              />
            </View>
          </View>

          {/* 内边距 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelContainer}>
              <Text style={styles.sliderLabel}>内边距</Text>
              <Text style={styles.sliderValue}>{readerStyle.padding}px</Text>
              <View style={styles.controlButton}>
                <TouchableOpacity 
                  onPress={() => decrementStyle('padding', 1, 0)} 
                >
                  <Text style={styles.controlButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => incrementStyle('padding', 1, 20)} 
                >
                  <Text style={styles.controlButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.sliderControl}>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={20}
                step={1}
                value={readerStyle.padding}
                onValueChange={handlePaddingChange}
                minimumTrackTintColor="#1EB1FC"
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor="#1EB1FC"
              />
            </View>
          </View>

          {/* 行距 */}
          <View style={styles.sliderContainer}>
            <View style={styles.sliderLabelContainer}>
              <Text style={styles.sliderLabel}>行距</Text>
              <Text style={styles.sliderValue}>{readerStyle.lineHeight}em</Text>
              <View style={styles.controlButton}>
                <TouchableOpacity 
                  onPress={() => decrementStyle('lineHeight', 0.1, 1)} 
                >
                  <Text style={styles.controlButtonText}>-</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => incrementStyle('lineHeight', 0.1, 3)} 
                >
                  <Text style={styles.controlButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.sliderControl}>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={3}
                step={0.1}
                value={readerStyle.lineHeight}
                onValueChange={(value) => {
                  const roundedValue = roundToStep(value, 0.1);
                  handleLineHeightChange(roundedValue);
                }}
                minimumTrackTintColor="#1EB1FC"
                maximumTrackTintColor="#d3d3d3"
                thumbTintColor="#1EB1FC"
              />
            </View>
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
    padding: 12,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    flexDirection: 'column',
  },
  colorOptions: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 10,
    paddingBottom: 10,
    paddingLeft: 3,
    paddingRight: 3,
    borderBottomWidth: 0.5,
    borderColor: 'white',
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
  menuRow: {
    flexDirection: 'row',
    paddingTop: 10,
    paddingLeft: 10,
    paddingRight: 10,
    gap: 20,
  },
  iconButton: {
    alignItems: 'center',
  },
  styleModal: {
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 35,
    marginRight: 35,
  },
  styleContent: {
    flexDirection: 'column',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 15,
  },
  sliderContainer: {
    flexDirection: 'column',
  },
  sliderLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 16,
    width: 64,
  },
  sliderValue: {
    fontSize: 16,
  },
  sliderControl: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  controlButton: {
    flexDirection: 'row',
    gap: 20,
  },
  controlButtonText: {
    fontSize: 18,
    color: '#1EB1FC',
  },
  slider: {
    width: '100%',
    height: 30,
  },

});

export default ReaderScreen;