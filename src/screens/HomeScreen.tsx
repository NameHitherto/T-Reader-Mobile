import React, { useEffect, useState, useMemo } from 'react';
import { StatusBar ,View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Animated, TouchableWithoutFeedback, Dimensions } from 'react-native';
import { pick } from '@react-native-documents/picker';
import { saveFile, loadBooks, deleteBook, webdavSyncFiles, webdavUpload, webdavUploadFile } from '../utils/fileUtils';
import * as RNFS from '@dr.pogodin/react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { DOMParser } from 'xmldom';
import Svg, { Path } from 'react-native-svg';
import LoadingAnimation, {AnimationType} from '../component/LoadingAnimation';
import {colors} from '../styles/global';
import FooterTab from '../component/FooterTab';
import Modal from 'react-native-modal';
import { HomeScreenNavigationProp } from '../route/navigation-types';
import { Book } from '../constant/type.map';

// 定义组件属性类型
type HomeScreenProps = {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<HomeScreenProps> = ({navigation}) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [isBooksLoaded, setIsBooksLoaded] = useState(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingType, setLoadingType] = useState<AnimationType>('roxy');
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [isBottomSheetVisible, setIsBottomSheetVisible] = useState(false);
  const toggleBottomSheet = () => setIsBottomSheetVisible(!isBottomSheetVisible);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const selectedBook = useMemo(() => {
    return books.find(book => book.id === selectedBookId);
  }, [selectedBookId, books]);
  const bookOptions = [
    {key: 'open', text: '打开', path: 'M21 4H3a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2M3 19V6h8v13zm18 0h-8V6h8zm-7-9.5h6V11h-6zm0 2.5h6v1.5h-6zm0 2.5h6V16h-6z'},
    {key: 'del', text: '删除', path: 'M7 21q-.825 0-1.412-.587T5 19V6H4V4h5V3h6v1h5v2h-1v13q0 .825-.587 1.413T17 21zM17 6H7v13h10zM9 17h2V8H9zm4 0h2V8h-2zM7 6v13z'},
    {key: 'info', text: '详情', path: 'M13 9h-2V7h2zm0 2h-2v6h2zm-1-7c-4.411 0-8 3.589-8 8s3.589 8 8 8s8-3.589 8-8s-3.589-8-8-8m0-2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12S6.477 2 12 2'},
  ]

  useEffect(() => {
    // 加载书籍
    loadBooksFromFileSystem();
  }, []);

  const loadBooksFromFileSystem = async () => {
    try {
      console.log('开始加载书籍...');
      setIsBooksLoaded(false);
      const loadedBooks = await loadBooks();
      setBooks(loadedBooks);
      setIsBooksLoaded(true);
    } catch (error) {
      console.error('Error loading books:', error);
    }
  };

  const syncFiles = async () => {
    try {
      // 下载云同步文件
      setLoadingType('text');
      setLoadingMessage('正在同步云文件...');
      setLoading(true);
      await webdavSyncFiles();
      // 重新加载书籍
      setLoadingMessage('正在整理书架...');
      await loadBooksFromFileSystem();
      setLoading(false);
    } catch (error) {
      console.error('文件同步失败:', error);
      setLoading(false);
    }
  };

  const addBook = async () => {
    try {
      const res = await pick({
        type: ['application/epub+zip'],
        allowMultiSelection: false,
      });
  
      if (res.length === 0) {
        return;
      }

      // 开始解析content uri
      setLoadingType('roxy');
      setLoadingMessage('正在复制书籍...');
      setLoading(true);

      const selectedFileUri = res[0].uri;
      const newBookId = Date.now().toString();
      const newBookPath = `${RNFS.DocumentDirectoryPath}/T-Reader/${newBookId}.epub`;
      
      const stat = await RNFS.stat(selectedFileUri);
      const selectedFilePath = stat.originalFilepath;
      console.log('selectedFilePath', selectedFilePath);

      // 开始将文件上传到 WebDAV 服务器
      setLoadingMessage('解析文件中...');
      const base64File = await RNFS.readFile(selectedFilePath, 'base64');

      await RNFS.writeFile(newBookPath, base64File, 'base64');

      // 将书籍上传到 WebDAV 服务器
      setLoadingMessage('正在同步到云服务器...');
      await webdavUploadFile(`${newBookId}.epub`, base64File);

      const unzipPath = `${RNFS.DocumentDirectoryPath}/T-Reader/${newBookId}`;
      await unzip(newBookPath, unzipPath);
  
      const containerXmlPath = `${unzipPath}/META-INF/container.xml`;
      const containerXml = await RNFS.readFile(containerXmlPath);
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(containerXml, 'text/xml');
      const rootfilePath = xmlDoc.getElementsByTagName('rootfile')[0].getAttribute('full-path');
      const contentOpfPath = `${unzipPath}/${rootfilePath}`;
      const contentOpf = await RNFS.readFile(contentOpfPath);
      const contentDoc = parser.parseFromString(contentOpf, 'text/xml');
      const metadata = contentDoc.getElementsByTagName('metadata')[0];
      const manifest = contentDoc.getElementsByTagName('manifest')[0];
      const coverId = Array.from(metadata.getElementsByTagName('meta')).find(meta => meta.getAttribute('name') === 'cover')?.getAttribute('content');
      const coverItem = Array.from(manifest.getElementsByTagName('item')).find(item => item.getAttribute('id') === coverId);
      let coverPath = coverItem ? `${unzipPath}/OEBPS/${coverItem.getAttribute('href')}` : null;

      // 若coverPath为null，则寻找名为cover的图片位置
      if(!coverPath){
        const imgPath = `${unzipPath}/OEBPS/Images/cover`;
        if(await RNFS.exists(`${imgPath}.jpg`)){
          coverPath = `${imgPath}.jpg`;
        }else if(await RNFS.exists(`${imgPath}.jpeg`)){
          coverPath = `${imgPath}.jpeg`;
        };
      }

      let coverUri = 'unknown';
      if (coverPath && await RNFS.exists(coverPath)) {
        // 读取封面图片数据并转换为 Base64 编码的 URI
        const coverData = await RNFS.readFile(coverPath, 'base64');
        coverUri = `data:image/jpeg;base64,${coverData}`;
      } else {
        console.log(`封面文件不存在: ${coverPath}`);
      }

      // 删除解压后的目录
      await RNFS.unlink(unzipPath);
  
      // 保存配置信息
      setLoadingMessage('正在生成并保存配置信息...');

      const newBook: Book = {
        id: newBookId,
        cover: coverPath ? coverUri : 'unknown',
        title: metadata.getElementsByTagName('dc:title')[0]?.textContent ?? '未知书名',
        path: selectedFilePath,
        added: new Date().toLocaleDateString(),
        author: metadata.getElementsByTagName('dc:creator')[0]?.textContent ?? '未知作者',
        lastRead: '',
        size: `${(stat.size / 1024 / 1024).toFixed(2)} MB`,
        language: metadata.getElementsByTagName('dc:language')[0]?.textContent ?? '未知语言',
        location: '',
      };

      console.log('newBook', newBook);

      await webdavUpload(`${newBookId}.json`, JSON.stringify(newBook));
      await saveFile(`${newBook.id}.json`, JSON.stringify(newBook));
  
      setBooks([...books, newBook]);

      setLoadingMessage('一切准备就绪!');

      await loadBooksFromFileSystem();

      setLoading(false);
    } catch (err) {
      setLoading(false);
      console.log(err);
    }
  };

  const openBook = (bookId: string) => {
    navigation.navigate('Reader', { bookId });
  };

  const openSetting = (key: string) => {
    if (key === 'setting') {
      navigation.navigate('Setting');
    }
  }

  const handleBookAction = (bookId: string, action: string) => {
    switch (action) {
      case 'open':
        openBook(bookId);
        break;
      case 'del':
        handleBookDel(bookId);
        break;
      case 'info':
        break;
      default:
        break
    }
  };

  const handleLongPress = (bookId: string) => {
    setSelectedBookId(bookId);
    if (selectedBook) {
      toggleBottomSheet();
    }
  };

  const handleCasualPress = () => {

  };

  // 删除书籍
  const handleBookDel = async(bookId: string) => {
    setIsBottomSheetVisible(false);
    await deleteBook(bookId);
    await loadBooksFromFileSystem();
  };

  return (
    <>
      <StatusBar
        backgroundColor={colors.header}
        barStyle='dark-content'
      />
      <TouchableWithoutFeedback onPress={handleCasualPress}>
        <View style={styles.container}>
          {/* 加载动画 */}
          <LoadingAnimation animationType={loadingType} isVisible={loading} message={loadingMessage} onBackdropPress={() => console.log("Pretend to Stop")}/>
          <View style={styles.header}>
            <Text style={styles.headerText}>书架</Text>
            <TouchableOpacity onPress={addBook} style={styles.iconButton}>
              <Svg width="32" height="32" viewBox="0 0 512 512">
                <Path d="m426.667 320l-.001 63.999h64.001v42.667h-64.001l.001 64H384v-64h-64V384l64-.001v-64zm-128 64v42.666h-256V384zM320 106.666v256h-64v-256zM149.334 85.333v277.333h-64V85.333zm85.333 21.333v256h-64v-256zm159.028.585l36.494 191.415h-68.286l-31.236-180.302z"/>
              </Svg>
            </TouchableOpacity>
            <TouchableOpacity onPress={syncFiles} style={styles.iconButton}>
              <Svg width="32" height="32" viewBox="0 0 24 24">
                <Path d="M13.03 18c.05.7.21 1.38.47 2h-7c-1.5 0-2.81-.5-3.89-1.57C1.54 17.38 1 16.09 1 14.58q0-1.95 1.17-3.48C3.34 9.57 4 9.43 5.25 9.15c.42-1.53 1.25-2.77 2.5-3.72S10.42 4 12 4c1.95 0 3.6.68 4.96 2.04S19 9.05 19 11h.1c-.74.07-1.45.23-2.1.5V11c0-1.38-.5-2.56-1.46-3.54C14.56 6.5 13.38 6 12 6s-2.56.5-3.54 1.46C7.5 8.44 7 9.62 7 11h-.5c-.97 0-1.79.34-2.47 1.03c-.69.68-1.03 1.5-1.03 2.47s.34 1.79 1.03 2.5c.68.66 1.5 1 2.47 1zM19 13.5V12l-2.25 2.25L19 16.5V15a2.5 2.5 0 0 1 2.5 2.5c0 .4-.09.78-.26 1.12l1.09 1.09c.42-.63.67-1.39.67-2.21c0-2.21-1.79-4-4-4m0 6.5a2.5 2.5 0 0 1-2.5-2.5c0-.4.09-.78.26-1.12l-1.09-1.09c-.42.63-.67 1.39-.67 2.21c0 2.21 1.79 4 4 4V23l2.25-2.25L19 18.5z"/>
              </Svg>
            </TouchableOpacity>
          </View>
          <FlatList
            data={books}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <View style={styles.bookContainer}>
                <TouchableOpacity 
                  style={styles.bookItem} 
                  onPress={() => openBook(item.id)}
                  onLongPress={() => handleLongPress(item.id)}
                  activeOpacity={0.5}
                >
                  <Image defaultSource={require('../assets/default_cover.png')} source={{ uri: item.cover }} style={styles.bookCover} />
                </TouchableOpacity>
                <Text 
                  style={styles.bookTitle}
                  numberOfLines={2}
                  ellipsizeMode='tail'
                >
                  {item.title}
                </Text>
              </View>
            )}
            ListEmptyComponent={() => (
              <View style={styles.bookEmptyContainer}>
                <Image
                  style={styles.bookEmptyImage}
                  source={isBooksLoaded ? require('../assets/book_empty.png') : require('../assets/book_load.png')}
                />
                <Text style={styles.bookEmptyText}>
                  {isBooksLoaded ? '开始添加新书吧' : '正在整理书架~'}
                </Text>
              </View>
            )}
            numColumns={3}
          />
          <FooterTab
            activeTab='home'
            onTabPress={(key) => openSetting(key)}
          />
          {/* 底部操作菜单 */}
          <Modal
            isVisible={isBottomSheetVisible}
            onBackButtonPress={toggleBottomSheet}
            onBackdropPress={toggleBottomSheet}
            backdropOpacity={0.3}
            statusBarTranslucent={true}
            deviceHeight={Dimensions.get('screen').height}
            animationIn={'fadeInUp'}
            animationOut={'fadeOutDown'}
            animationInTiming={300}
            animationOutTiming={100}
            useNativeDriver={true}
            backdropTransitionOutTiming={1}
            hideModalContentWhileAnimating={false}
            style={bottomSheetModalStyles.modal}
          >
            <View style={bottomSheetModalStyles.content}>
              <View style={bottomSheetModalStyles.header}>
                <View style={bottomSheetModalStyles.bookInfo}>
                  <Image 
                    defaultSource={require('../assets/default_cover.png')} 
                    source={{ uri: selectedBook?.cover }} 
                    style={bottomSheetModalStyles.bookCover}
                  />
                  <View style={bottomSheetModalStyles.bookDetail}>
                    <Text>{selectedBook?.title}</Text>
                    <Text style={{fontSize: 12, color: colors.grey}}>{selectedBook?.author}</Text>
                  </View>
                </View>
              </View>
              <View style={bottomSheetModalStyles.footer}>
                {bookOptions.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => handleBookAction(selectedBookId!, option.key)}
                    style={bottomSheetModalStyles.optionItem}
                  >
                    <Svg
                      width={32}
                      height={32}
                      viewBox="0 0 24 24"
                    >
                      <Path 
                        d={option.path}
                        fill={colors.lightYellow}
                        stroke={colors.iconStroke}
                        strokeWidth={0}
                      />
                    </Svg>
                    <Text style={{fontSize: 13}}>{option.text}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Modal>
        </View>
      </TouchableWithoutFeedback>
    </>
  );
};

// 常规样式
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingTop: 0,
    padding: 10,
    backgroundColor: colors.header,
    borderBottomColor: colors.lightGrey,
    borderBottomWidth: 0.5,
  },
  headerText: {
    fontSize: 24,
    fontWeight: '600',
    flex: 1,
    marginLeft: 5,
  },
  iconButton: {
    marginHorizontal: 10,
  },
  bookContainer: {
    alignItems: 'flex-start',
    paddingTop: 5,
    padding: 10,
  },
  bookItem: {
    alignItems: 'flex-start',
    boxShadow: '#555555 0px 0px 3px 0px',
  },
  bookCover: {
    width: 100,
    height: 150,
    resizeMode: 'cover',
  },
  bookTitle: {
    marginTop: 5,
    textAlign: 'left',
    justifyContent: 'center',
    fontSize: 14,
    width: 100,
    height: 36,
    lineHeight: 18,
    fontWeight: '500',
  },
  bookEmptyContainer: {
    height: Dimensions.get('window').height - 130, // 保守计算页眉和页脚的高度和
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookEmptyImage: {
    width: 150,
    height: 150,
    resizeMode: 'contain',
  },
  bookEmptyText: {
    fontSize: 18,
    color: colors.darkGrey,
    marginTop: 10,
  }
});
// 底部选项卡样式
const bottomSheetModalStyles = StyleSheet.create({
  modal: {
    justifyContent: 'flex-end',
  },
  content: {
    width: '100%',
    backgroundColor: 'white',
    padding: 10,
    flexDirection: 'column',
    borderRadius: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-start', // space-between
    alignItems: 'center',
    borderBottomColor: colors.lightGrey,
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  bookInfo: {
    width: '80%',
    flexDirection: 'row',
  },
  bookCover: {
    width: 50,
    height: 75,
    resizeMode: 'cover',
  },
  bookDetail: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
    marginLeft: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 15,
  },
  optionItem: {
    width: 80,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  }
})
export default HomeScreen;