import React, { useEffect, useState } from 'react';
import { View, Text, Button, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import openDocument from 'react-native-document-picker';
import { StackNavigationProp } from '@react-navigation/stack';
import { saveFile, loadBooks, deleteBook, readFileByPath, webdavSyncFiles } from '../utils/fileUtils';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { DOMParser } from 'xmldom';

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
  
      const u8File = await readFileByPath(selectedFilePath);
      const bufferFile = new TextEncoder().encode(u8File).buffer;
      const file = new Blob([bufferFile], { type: 'application/epub+zip' });
  
      const newBookId = Date.now().toString();
      const newBookPath = `${RNFS.DocumentDirectoryPath}/T-Reader/${newBookId}.epub`;
      const contents = new Uint8Array(bufferFile);
  
      const base64Contents = Buffer.from(contents).toString('base64');
      await RNFS.writeFile(newBookPath, base64Contents, 'base64');
  
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
        size: `${(contents.length / 1024 / 1024).toFixed(2)} MB`,
        language: metadata.getElementsByTagName('language')[0].textContent ?? '未知语言',
        location: '',
      };
  
      await saveFile(`${newBook.id}.json`, JSON.stringify(newBook));
  
      setBooks([...books, newBook]);
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
        <Button title="添加书籍" onPress={addBook} />
        <Button title="同步文件" onPress={syncFiles} />
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