import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import DocumentPicker from 'react-native-document-picker';
import { StackNavigationProp } from '@react-navigation/stack';
import { saveFile, loadBooks, deleteBook, webdavSyncFiles, webdavUpload, webdavUploadFile } from '../utils/fileUtils';
import RNFS, { readFile } from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { DOMParser } from 'xmldom';
import Svg, { Path } from 'react-native-svg';
import LoadingAnimation, {AnimationType} from '../component/LoadingAnimation';

type RootStackParamList = {
  Home: undefined;
  Reader: { bookId: string };
};

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Book {
  id: string;
  title: string;
  cover: string;
  path: string;
  added: string;
  author: string;
  lastRead: string;
  size: string;
  language: string;
  location: string;
}

const HomeScreen = () => {
  const navigation = useNavigation<HomeScreenNavigationProp>();
  const [books, setBooks] = useState<Book[]>([]);
  const [focusedBookId, setFocusedBookId] = useState<string | null>(null);
  const [bookCoverOpacity] = useState(new Animated.Value(1));
  const [iconScale] = useState(new Animated.Value(0));
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingType, setLoadingType] = useState<AnimationType>('roxy');
  const [loadingMessage, setLoadingMessage] = useState<string>('');

  useEffect(() => {
    loadBooksFromFileSystem();
  }, []);

  const loadBooksFromFileSystem = async () => {
    try {
      const loadedBooks = await loadBooks();
      for (const book of loadedBooks) {
        try {
          const epubPath = `${RNFS.DocumentDirectoryPath}/T-Reader/${book.id}.epub`;
          const unzipPath = `${RNFS.DocumentDirectoryPath}/T-Reader/${book.id}`;
          await unzip(epubPath, unzipPath);
  
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

          if (coverPath && await RNFS.exists(coverPath)) {
            // 读取封面图片数据并转换为 Base64 编码的 URI
            const coverData = await RNFS.readFile(coverPath, 'base64');
            const coverUri = `data:image/jpeg;base64,${coverData}`;
            book.cover = coverUri;
          } else {
            console.log(`封面文件不存在: ${coverPath}`);
            book.cover = 'unknown';
          }

          // 删除解压后的目录
          await RNFS.unlink(unzipPath);
        } catch (error) {
          console.log('Error loading cover for book:', book.title, error);
        }
      }
  
      setBooks(loadedBooks);
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
      const res = await DocumentPicker.pick({
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
      const base64File = await readFile(selectedFilePath, 'base64');

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
        cover: coverPath ? coverPath : 'unknown',
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
      if (DocumentPicker.isCancel(err)) {
        console.log('User cancelled the picker');
      } else {
        throw err;
      }
    }
  };

  const openBook = (bookId: string) => {
    navigation.navigate('Reader', { bookId });
  };

  const handleLongPress = (bookId: string) => {
    setFocusedBookId(bookId);
    bookCoverOpacity.setValue(1);
    iconScale.setValue(0);
    Animated.parallel([
      Animated.timing(bookCoverOpacity, {
        toValue: 0.3,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(iconScale, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleCasualPress = () => {
    setFocusedBookId(null);
    bookCoverOpacity.setValue(1);
    iconScale.setValue(0);
  };

  // 删除书籍
  const handleBookDel = async(bookId: string) => {
    await deleteBook(bookId);
    await loadBooksFromFileSystem();
  };

  return (
    <TouchableWithoutFeedback onPress={handleCasualPress}>
      <View style={styles.container}>
        <LoadingAnimation animationType={loadingType} isVisible={loading} message={loadingMessage} onBackdropPress={() => console.log("Pretend to Stop")}/>
        <View style={styles.header}>
          <Text style={styles.headerText}>全部书籍</Text>
          <TouchableOpacity onPress={addBook} style={styles.iconButton}>
            <Svg width="32" height="32" viewBox="0 0 24 24">
              <Path d="M5 21q-.825 0-1.412-.587T3 19V5q0-.825.588-1.412T5 3h14q.825 0 1.413.588T21 5v6.7q-.475-.225-.975-.387T19 11.075V5H5v14h6.05q.075.55.238 1.05t.387.95zm0-3v1V5v6.075V11zm2-1h4.075q.075-.525.238-1.025t.362-.975H7zm0-4h6.1q.8-.75 1.788-1.25T17 11.075V11H7zm0-4h10V7H7zm11 14q-2.075 0-3.537-1.463T13 18t1.463-3.537T18 13t3.538 1.463T23 18t-1.463 3.538T18 23m-.5-2h1v-2.5H21v-1h-2.5V15h-1v2.5H15v1h2.5z"/>
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
                activeOpacity={1}
              >
                <Animated.View style={{opacity: item.id === focusedBookId ? bookCoverOpacity : 1, position:'relative'}}>
                  <Image defaultSource={require('../assets/default_cover.png')} source={{ uri: item.cover }} style={styles.bookCover} />
                </Animated.View>
                {item.id === focusedBookId && (
                  <Animated.View style={{ 
                    transform: [
                      { scale: iconScale }
                    ], 
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    marginTop: -24,
                    marginLeft: -24
                  }}>
                    <TouchableOpacity onPress={() => handleBookDel(item.id)}>
                      <Svg width="48" height="48" viewBox="0 0 24 24">
                        <Path d="M7 6v13zm0 15q-.825 0-1.412-.587T5 19V6h-.025q-.425 0-.7-.288T4 5t.288-.712T5 4h4q0-.425.288-.712T10 3h4q.425 0 .713.288T15 4h4q.425 0 .713.288T20 5t-.288.713T19 6v3.5q0 .425-.288.713T18 10.5t-.712-.288T17 9.5V6H7v13h2.675q.425 0 .713.288t.287.712q0 .4-.288.7t-.712.3zm3-13q-.425 0-.712.288T9 9v7q0 .425.288.713T10 17t.713-.288T11 16V9q0-.425-.288-.712T10 8m4 0q-.425 0-.712.288T13 9v1.5q0 .425.288.713T14 11.5t.713-.288T15 10.5V9q0-.425-.288-.712T14 8m3 14q-2.075 0-3.537-1.463T12 17t1.463-3.537T17 12q1.025 0 1.938.4t1.587 1.075t1.075 1.588T22 17q0 2.075-1.463 3.538T17 22m.5-5.2v-2.3q0-.2-.15-.35T17 14t-.35.15t-.15.35v2.275q0 .2.075.388t.225.337l1.5 1.5q.15.15.35.15T19 19t.15-.35t-.15-.35z"/>
                      </Svg>
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </TouchableOpacity>
              <Text style={styles.bookTitle}>{item.title}</Text>
            </View>
          )}
          numColumns={3}
        />
    </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  iconButton: {
    marginHorizontal: 10,
  },
  bookContainer: {
    alignItems: 'flex-start',
    margin: 5,
  },
  bookItem: {
    alignItems: 'flex-start',
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
  },
});

export default HomeScreen;