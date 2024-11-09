import RNFS from 'react-native-fs';
import { DOMParser } from 'xmldom';

const WEBDAV_URL = 'https://dav.jianguoyun.com/dav/T-Reader/';
const WEBDAV_USER = '605351778@qq.com';
const WEBDAV_PASS = 'ayntpghyezyf7pna';

export const saveFile = async (filename: string, contents: string, directory?: string) => {
  const path = directory ? `${directory}/T-Reader/${filename}` : `${RNFS.DocumentDirectoryPath}/T-Reader/${filename}`;
  await RNFS.writeFile(path, contents, 'utf8');
};

export const loadBooks = async (directory?: string) => {
  const booksDir = directory ? `${directory}/T-Reader` : `${RNFS.DocumentDirectoryPath}/T-Reader`;
  if (!(await RNFS.exists(booksDir))) {
    await RNFS.mkdir(booksDir);
  } else {
    console.log("目录 'T-Reader' 已存在。");
  }
  const files = await RNFS.readDir(booksDir);
  const bookFiles = files.filter(file => file.name.endsWith('.json'));
  const loadedBooks = await Promise.all(bookFiles.map(async file => {
    const content = await RNFS.readFile(file.path);
    const book = JSON.parse(content);
    if (book.id) {
      return book;
    }
    return null;
  }));
  return loadedBooks.filter(book => book !== null);
};

export const deleteBook = async (filename: string, directory?: string) => {
  const path = directory ? `${directory}/T-Reader/${filename}` : `${RNFS.DocumentDirectoryPath}/T-Reader/${filename}`;
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
    console.log(`书籍 '${filename}' 删除成功。`);
  } else {
    console.log(`书籍 '${filename}' 不存在。`);
  }
};

export const readFileByPath = async (filepath: string) => {
  const contents = await RNFS.readFile(filepath, 'base64');
  return contents;
};

export const webdavUpload = async (filename: string, contents: string) => {
  const response = await fetch(`${WEBDAV_URL}${filename}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': 'Basic ' + btoa(`${WEBDAV_USER}:${WEBDAV_PASS}`)
    },
    body: contents
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  console.log('webdavUploaded....');
};

export const webdavGet = async (filename: string) => {
  const response = await fetch(`${WEBDAV_URL}${filename}`, {
    method: 'GET',
    headers: {
      'Authorization': 'Basic ' + btoa(`${WEBDAV_USER}:${WEBDAV_PASS}`)
    }
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }

  const contents = await response.arrayBuffer();
  return new Uint8Array(contents);
};

export const webdavDelete = async (filename: string) => {
  const response = await fetch(`${WEBDAV_URL}${filename}`, {
    method: 'DELETE',
    headers: {
      'Authorization': 'Basic ' + btoa(`${WEBDAV_USER}:${WEBDAV_PASS}`)
    }
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  console.log('云同步文件删除成功');
};

export const webdavSyncFiles = async (directory?: string) => {
  const response = await fetch(WEBDAV_URL, {
    method: 'PROPFIND',
    headers: {
      'Depth': '1',
      'Authorization': 'Basic ' + btoa(`${WEBDAV_USER}:${WEBDAV_PASS}`)
    }
  });

  if (!response.ok) {
    throw new Error('获取云端文件列表失败');
  }

  const text = await response.text();

  const files = parseWebdavResponse(text);

  const booksDir = directory ? `${directory}/T-Reader` : `${RNFS.DocumentDirectoryPath}/T-Reader`;

  if (!(await RNFS.exists(booksDir))) {
    await RNFS.mkdir(booksDir);
  } else {
    // 清理目录旧文件
    RNFS.unlink(booksDir);
    RNFS.mkdir(booksDir);
  }

  await Promise.all(files.map(async file => {
    const fileUrl = `${WEBDAV_URL}${file}`;
    const fileResponse = await fetch(fileUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(`${WEBDAV_USER}:${WEBDAV_PASS}`)
      }
    });

    if (!fileResponse.ok) {
      throw new Error('下载文件失败');
    }

    const contents = await fileResponse.arrayBuffer();
    const filePath = `${booksDir}/${file}`;
    const base64Contents = arrayBufferToBase64(contents);
    await RNFS.writeFile(filePath, base64Contents, 'base64');
    console.log(`文件 '${filePath}' 下载并保存成功。`);
  }));
};

/* 将ArrayBuffer转换为Base64字符串 */
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

/* 提取响应XML中所有后缀为epub或json的文件名 */
const parseWebdavResponse = (response: string): string[] => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(response, 'application/xml');
  const displaynames = xmlDoc.getElementsByTagName('d:displayname');
  const files: string[] = [];

  for (let i = 0; i < displaynames.length; i++) {
    const displayname = displaynames[i].textContent;
    if (displayname && (displayname.endsWith('.epub') || displayname.endsWith('.json'))) {
      files.push(displayname);
    }
  }

  return files;
};