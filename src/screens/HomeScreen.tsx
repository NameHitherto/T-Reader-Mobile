import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import openDocument from 'react-native-document-picker';
import { StackNavigationProp } from '@react-navigation/stack';
import { saveFile, loadBooks, deleteBook, readFileByPath, webdavSyncFiles, webdavUpload } from '../utils/fileUtils';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { DOMParser } from 'xmldom';
import Svg, { Path } from 'react-native-svg';
import { Buffer } from 'buffer';

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
          const coverPath = coverItem ? `${unzipPath}/OEBPS/${coverItem.getAttribute('href')}` : null;

          if (coverPath && await RNFS.exists(coverPath)) {
            // 读取封面图片数据并转换为 Base64 编码的 URI
            const coverData = await RNFS.readFile(coverPath, 'base64');
            const coverUri = `data:image/jpeg;base64,${coverData}`;
            book.cover = coverUri;
          } else {
            console.error(`封面文件不存在: ${coverPath}`);
            book.cover = 'unknown';
          }

          // 删除解压后的目录
          await RNFS.unlink(unzipPath);
        } catch (error) {
          console.error('Error loading cover for book:', book.title, error);
        }
      }
  
      setBooks(loadedBooks);
    } catch (error) {
      console.error('Error loading books:', error);
    }
  };

  const syncFiles = async () => {
    try {
      await webdavSyncFiles();
      console.log('文件同步成功');
      await loadBooksFromFileSystem();
    } catch (error) {
      console.error('文件同步失败:', error);
    }
  };

  const addBook = async () => {
    try {
      const res = await openDocument.pick({
        type: ['application/epub+zip'],
      });
  
      if (res.length === 0) {
        return;
      }
  
      const selectedFilePath = res[0].uri;
  
      if (books.find(book => book.path === selectedFilePath)) {
        console.log("该文件已经添加过了");
        return;
      }
  
      const base64File = await readFileByPath(selectedFilePath);
      const u8String = Buffer.from(base64File, 'base64').toString('utf8');
      console.log('u8String', u8String);
      const newBookId = Date.now().toString();
      const newBookPath = `${RNFS.DocumentDirectoryPath}/T-Reader/${newBookId}.epub`;

      await RNFS.writeFile(newBookPath, base64File, 'base64');
  
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
      const coverPath = coverItem ? `${unzipPath}/OEBPS/${coverItem.getAttribute('href')}` : null;

      // 将书籍上传到 WebDAV 服务器
      await webdavUpload(`${newBookId}.epub`, u8String);

      let coverUri = 'unknown';
      if (coverPath && await RNFS.exists(coverPath)) {
        // 读取封面图片数据并转换为 Base64 编码的 URI
        const coverData = await RNFS.readFile(coverPath, 'base64');
        coverUri = `data:image/jpeg;base64,${coverData}`;
      } else {
        console.error(`封面文件不存在: ${coverPath}`);
      }

      // 删除解压后的目录
      await RNFS.unlink(unzipPath);
  
      const newBook: Book = {
        id: newBookId,
        cover: coverUri,
        title: metadata.getElementsByTagName('title')[0].textContent ?? '未知书名',
        path: selectedFilePath,
        added: new Date().toLocaleDateString(),
        author: metadata.getElementsByTagName('creator')[0].textContent ?? '未知作者',
        lastRead: '',
        size: `${(base64File.length / 1024 / 1024).toFixed(2)} MB`,
        language: metadata.getElementsByTagName('language')[0].textContent ?? '未知语言',
        location: '',
      };

      console.log('newBook', newBook);

      await webdavUpload(`${newBookId}.json`, JSON.stringify(newBook));
      await saveFile(`${newBook.id}.json`, JSON.stringify(newBook));
  
      setBooks([...books, newBook]);
      await loadBooksFromFileSystem();
      console.log('Books', books);
    } catch (err) {
      if (openDocument.isCancel(err)) {
        console.log('User cancelled the picker');
      } else {
        throw err;
      }
    }
  };

  const openBook = (bookId: string) => {
    navigation.navigate('Reader', { bookId });
  };

  return (
    <View style={styles.container}>
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
          <TouchableOpacity style={styles.bookItem} onPress={() => openBook(item.id)}>
            <Image source={{ uri: item.cover }} style={styles.bookCover} />
            <Text style={styles.bookTitle}>{item.title}</Text>
          </TouchableOpacity>
        )}
        numColumns={3}
      />
    </View>
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
  bookItem: {
    flex: 1,
    alignItems: 'center',
    margin: 5,
  },
  bookCover: {
    width: 100,
    height: 150,
    resizeMode: 'cover',
  },
  bookTitle: {
    marginTop: 5,
    textAlign: 'center',
    fontSize: 14,
  },
});

export default HomeScreen;