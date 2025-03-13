import React, { useEffect, useRef, useState, useMemo } from 'react';
import { StatusBar ,View, TouchableOpacity, StyleSheet, Dimensions, BackHandler, AppState, AppStateStatus, Text } from 'react-native';
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
import { colors } from '../styles/global';

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

  // 黑夜模式
  const isDarkMode = useMemo(() => {
    return readerStyle.backgroundColor === '#000000';
  }, [readerStyle]);

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
  // 更多样式设置
  const moreStyles = [
    {key: 'fontSize', text: '字号', step: 1, min: 12, max: 24},
    {key: 'textIndent', text: '首行缩进', step: 1, min: 0, max: 10},
    {key: 'padding', text: '内边距', step: 1, min: 0, max: 20},
    {key: 'lineHeight', text: '行距', step: 0.1, min: 1, max: 3},
  ]

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

  // 切换日间/夜间模式
  const toggleMode = () => {
    setReaderStyle(prev => ({
      ...prev,
      backgroundColor: prev.backgroundColor === '#000000' ? '#ffffff' : '#000000',
      color: prev.color === '#000000' ? '#ffffff' : '#000000',
    }));
  };

  return (
    <>
      <StatusBar 
        backgroundColor={readerStyle.backgroundColor}
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      />
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
          <View style={[styles.modalContent, {backgroundColor: isDarkMode ? '#a3a3a3' : '#d4d4d4'}]}>
            <View style={styles.modalGrid}>
              <View style={styles.modalRow}>
                <View style={[styles.modalCol, {backgroundColor: isDarkMode ? '#737373' : '#f5f5f5'}]}>
                  <TouchableOpacity style={[styles.modalItem, {backgroundColor: isDarkMode ? 'black' : 'white'}]} onPress={toggleToc}>
                    <Svg width="32" height="32" viewBox="0 0 32 32">
                      <Path strokeWidth={0} fill={isDarkMode ? 'white' : 'black'} d="M26 2H8a2 2 0 0 0-2 2v4H4v2h2v5H4v2h2v5H4v2h2v4a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2m0 26H8v-4h2v-2H8v-5h2v-2H8v-5h2V8H8V4h18Z"/>
                      <Path strokeWidth={0} fill={isDarkMode ? 'white' : 'black'} d="M14 8h8v2h-8zm0 7h8v2h-8zm0 7h8v2h-8z" />
                    </Svg>
                    <Text style={{fontSize: 12, color: isDarkMode ? 'white' : 'black'}}>目录</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalItem, {backgroundColor: isDarkMode ? 'black' : 'white'}]} onPress={toggleMode}>
                    <Svg width="32" height="32" viewBox='0 0 24 24'>
                      <Path strokeWidth={0} fill={isDarkMode ? 'white' : 'black'} d={!isDarkMode ? 'M13.1 23h-2.6l.5-.312q.5-.313 1.088-.7t1.087-.7l.5-.313q2.025-.15 3.738-1.225t2.712-2.875q-2.15-.2-4.075-1.088t-3.45-2.412t-2.425-3.45T9.1 5.85Q7.175 6.925 6.088 8.813T5 12.9v.3l-.3.138q-.3.137-.663.287t-.662.288l-.3.137q-.05-.275-.062-.575T3 12.9q0-3.65 2.325-6.437T11.25 3q-.45 2.475.275 4.838t2.5 4.137t4.138 2.5T23 14.75q-.65 3.6-3.45 5.925T13.1 23M6 21h4.5q.625 0 1.063-.437T12 19.5t-.425-1.062T10.55 18h-1.3l-.5-1.2q-.35-.825-1.1-1.312T6 15q-1.25 0-2.125.863T3 18q0 1.25.875 2.125T6 21m0 2q-2.075 0-3.537-1.463T1 18t1.463-3.537T6 13q1.5 0 2.738.813T10.575 16Q12 16.05 13 17.063t1 2.437q0 1.45-1.025 2.475T10.5 23z' : 'M12 5q-.425 0-.712-.288T11 4V2q0-.425.288-.712T12 1t.713.288T13 2v2q0 .425-.288.713T12 5m4.95 2.05q-.275-.275-.275-.7t.275-.7l1.4-1.425q.3-.3.712-.3t.713.3q.275.275.275.7t-.275.7L18.35 7.05q-.275.275-.7.275t-.7-.275M20 13q-.425 0-.713-.288T19 12t.288-.712T20 11h2q.425 0 .713.288T23 12t-.288.713T22 13zm-1.65 6.775l-1.4-1.425q-.275-.275-.275-.7t.275-.7t.7-.275t.7.275l1.425 1.4q.3.3.3.712t-.3.713t-.712.3t-.713-.3M5.65 7.05L4.225 5.625q-.275-.275-.275-.7t.275-.7q.3-.3.713-.3t.712.3l1.4 1.425q.275.275.275.7t-.275.7t-.7.275t-.7-.275M6 19h4.5q.625 0 1.063-.437T12 17.5t-.425-1.062t-1.05-.438H9.25l-.5-1.2q-.35-.825-1.1-1.312T6 13q-1.25 0-2.125.875T3 16t.875 2.125T6 19m0 2q-2.075 0-3.537-1.463T1 16t1.463-3.537T6 11q1.5 0 2.738.813T10.575 14q1.45 0 2.438 1.075T14 17.65q-.05 1.425-1.062 2.388T10.5 21zm8-3.35q-.125-.5-.25-.975t-.25-.975q1.125-.475 1.813-1.475T16 12q0-1.65-1.175-2.825T12 8q-1.5 0-2.625.975T8.05 11.45q-.5-.125-1.025-.225T6 11q.35-2.2 2.063-3.6T12 6q2.5 0 4.25 1.75T18 12q0 1.925-1.1 3.463T14 17.65M12.025 12'}/>
                    </Svg>
                    <Text style={{fontSize: 12, color: isDarkMode ? 'white' : 'black'}}>{isDarkMode ? '进入日间' : '进入夜间'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.modalCol, {backgroundColor: isDarkMode ? '#737373' : '#f5f5f5'}]}>
                  <TouchableOpacity style={[styles.modalItem, {backgroundColor: isDarkMode ? 'black' : 'white'}]} onPress={() => {console.log('字体设置')}}>
                    <Svg width={32} height={32} viewBox='0 0 24 24'>
                      <Path strokeWidth={0} fill={isDarkMode ? 'white' : 'black'} d='M15 4h7v2h-7zm1 4h6v2h-6zm2 4h4v2h-4zM9.307 4l-6 16h2.137l1.875-5h6.363l1.875 5h2.137l-6-16zm-1.239 9L10.5 6.515L12.932 13z'/>
                    </Svg>
                    <Text style={{fontSize: 12, color: isDarkMode ? 'white' : 'black'}}>字体设置</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalItem, {backgroundColor: isDarkMode ? 'black' : 'white'}]} onPress={toggleStyle}>
                    <Svg width="32" height="32" viewBox="0 0 24 24">
                      <Path strokeWidth={0} fill={isDarkMode ? 'white' : 'black'} d="M13.354 8.75H4a.75.75 0 0 1 0-1.5h9.354a2.751 2.751 0 0 1 5.293 0H20a.75.75 0 0 1 0 1.5h-1.354a2.751 2.751 0 0 1-5.292 0M14.75 8a1.25 1.25 0 1 1 2.5 0a1.25 1.25 0 0 1-2.5 0m-4.103 8.75H20a.75.75 0 0 0 0-1.5h-9.353a2.751 2.751 0 0 0-5.293 0H4a.75.75 0 0 0 0 1.5h1.354a2.751 2.751 0 0 0 5.292 0M6.75 16a1.25 1.25 0 1 1 2.5 0a1.25 1.25 0 0 1-2.5 0"/>
                    </Svg>
                    <Text style={{fontSize: 12, color: isDarkMode ? 'white' : 'black'}}>更多样式</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.modalRow}>
                <View style={[styles.modalCol, {backgroundColor: isDarkMode ? '#737373' : '#f5f5f5'}]}>
                  <TouchableOpacity
                    style={[styles.colorButton, { backgroundColor: '#ffffff' }, {borderColor: readerStyle.backgroundColor === '#ffffff' ? '#f43f5e' : '#ffffff'}]}
                    onPress={() => setReaderStyle({...readerStyle, backgroundColor: '#ffffff', color: '#000000' })}
                  />
                  <TouchableOpacity
                    style={[styles.colorButton, { backgroundColor: '#faebd7' }, {borderColor: readerStyle.backgroundColor === '#faebd7' ? '#f43f5e' : '#ffffff'}]}
                    onPress={() => setReaderStyle({...readerStyle, backgroundColor: '#faebd7', color: '#000000' })}
                  />
                  <TouchableOpacity
                    style={[styles.colorButton, { backgroundColor: '#000000' }, {borderColor: readerStyle.backgroundColor === '#000000' ? '#f43f5e' : '#ffffff'}]}
                    onPress={() => setReaderStyle({...readerStyle, backgroundColor: '#000000', color: '#ffffff' })}
                  />
                </View>
              </View>
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
          <View style={[styles.styleContent, {backgroundColor: isDarkMode ? '#a3a3a3' : '#d4d4d4'}]}>
            {moreStyles.map((style) => (
              <View style={styles.styleContainer} key={style.key}>
                <View style={[styles.styleLabelContainer, {backgroundColor: isDarkMode ? '#737373' : '#f5f5f5'}]}>
                  <Text style={[styles.styleLabel, {color: isDarkMode ? '#e5e7eb' : '#525252'}]}>{style.text}</Text>
                  <View style={[styles.controlContainer, {backgroundColor: isDarkMode ? 'black' : 'white'}]}>
                    <TouchableOpacity 
                      onPress={() => decrementStyle(style.key as keyof typeof readerStyle, style.step, style.min)} 
                      style={styles.controlButton}
                    >
                      <Svg width="24" height="24" viewBox="0 0 24 24">
                        <Path fill={isDarkMode ? colors.lightGrey : colors.darkGrey} d='M18 12.998H6a1 1 0 0 1 0-2h12a1 1 0 0 1 0 2'/>
                      </Svg>
                    </TouchableOpacity>
                    <Text style={[styles.styleValue, {color: isDarkMode ? 'white' : 'black'}]}>{readerStyle[style.key as keyof typeof readerStyle]}</Text>
                    <TouchableOpacity 
                      onPress={() => incrementStyle(style.key as keyof typeof readerStyle, style.step, style.max)} 
                      style={styles.controlButton}
                    >
                      <Svg width="24" height="24" viewBox="0 0 24 24">
                        <Path fill={isDarkMode ? colors.lightGrey : colors.darkGrey} d='M13 13v7a1 1 0 0 1-2 0v-7H4a1 1 0 0 1 0-2h7V4a1 1 0 0 1 2 0v7h7a1 1 0 0 1 0 2z'/>
                      </Svg>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View> 
        </Modal>
      </View>
    </>
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
  },
  modalContent: {
    backgroundColor: '#d4d4d4',
    borderRadius: 15,
  },
  modalGrid: {
    padding: 12,
    flexDirection: 'column',
    gap: 10,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  modalCol: {
    padding: 8,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    gap: 10,
  },
  modalItem: {
    flex: 1,
    paddingTop: 6,
    paddingBottom: 3,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    alignContent: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
  },
  colorButton: {
    width: 32,
    height: 32,
    borderRadius: 25,
    borderWidth: 1,
  },
  styleModal: {
    height: 'auto',
    alignSelf: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  styleContent: {
    flexDirection: 'column',
    backgroundColor: '#d4d4d4',
    padding: 12,
    borderRadius: 15,
    gap: 10,
    boxShadow: '0 0 6px rgba(0, 0, 0, 0.5)',
  },
  styleContainer: {
    flexDirection: 'column',
  },
  styleLabelContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    padding: 6,
    paddingTop: 3,
    gap: 3,
  },
  styleLabel: {
    fontSize: 14,
  },
  controlContainer: {
    width: 150,
    paddingTop: 4,
    paddingBottom: 4,
    paddingLeft: 8,
    paddingRight: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 20,
    backgroundColor: 'white',
    borderRadius: 10,
  },
  styleValue: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 22,
  },
  controlButton: {
    width: 30,
    height: 26,
    alignItems: 'center',
  },
});

export default ReaderScreen;