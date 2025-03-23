import RNFS from 'react-native-fs';
import { DOMParser } from 'xmldom';
import { Buffer } from 'buffer';

// setting.json
export interface Setting {
  WEBDAV_BASE_URL?: string;
  WEBDAV_FOLDER?: string;
  WEBDAV_USER?: string;
  WEBDAV_PASS?: string;
  MODEL_NAME?: string;
  MODEL_BASE_URL?: string;
  MODEL_API_KEY?: string;
}

/**
 * 读取配置文件并处理
 */
const getDirectSetting = async () => {
  const setting = await readSetting();
  // 云同步URL
  let webdavUrl = setting.WEBDAV_BASE_URL;
  if (setting.WEBDAV_FOLDER?.endsWith('/')) {
    webdavUrl += setting.WEBDAV_FOLDER;
  } else {
    webdavUrl += `${setting.WEBDAV_FOLDER}/`;
  }
  // 其余直接引用
  const directSetting = {
    WEBDAV_URL: webdavUrl,
    WEBDAV_USER: setting.WEBDAV_USER,
    WEBDAV_PASS: setting.WEBDAV_PASS,
    MODEL_NAME: setting.MODEL_NAME,
    MODEL_BASE_URL: setting.MODEL_BASE_URL,
    MODEL_API_KEY: setting.MODEL_API_KEY
  };
  return directSetting;
};

// 保存文件
export const saveFile = async (filename: string, contents: string, directory?: string) => {
  const path = directory ? `${directory}/T-Reader/${filename}` : `${RNFS.DocumentDirectoryPath}/T-Reader/${filename}`;
  await RNFS.writeFile(path, contents, 'utf8');
};

// 读取书籍信息
export const loadBooks = async (directory?: string) => {
  const booksDir = directory ? `${directory}/T-Reader` : `${RNFS.DocumentDirectoryPath}/T-Reader`;
  if (!(await RNFS.exists(booksDir))) {
    await RNFS.mkdir(booksDir);
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

// 删除书籍
export const deleteBook = async (filename: string, directory?: string) => {
  const path = directory ? `${directory}/T-Reader/${filename}` : `${RNFS.DocumentDirectoryPath}/T-Reader/${filename}`;
  await RNFS.unlink(`${path}.epub`);
  await webdavDelete(`${filename}.epub`);
  await RNFS.unlink(`${path}.json`);
  await webdavDelete(`${filename}.json`);
};

export const readFileByPath = async (filepath: string) => {
  const contents = await RNFS.readFile(filepath, 'base64');
  return contents;
};

// 读取系统配置文件
export const readSetting = async ():Promise<Setting> => {
  const settingPath = `${RNFS.DocumentDirectoryPath}/T-Reader/setting.json`;
  if (!(await RNFS.exists(settingPath))) {
    return {};
  }
  const content = await RNFS.readFile(settingPath);
  return JSON.parse(content);
};

// 保存系统配置文件
export const saveSetting = async (setting: Setting) => {
  const settingPath = `${RNFS.DocumentDirectoryPath}/T-Reader/setting.json`;
  await RNFS.writeFile(settingPath, JSON.stringify(setting), 'utf8');
};

// 禁止上传ePub文件，只允许上传JSON文件
export const webdavUpload = async (filename: string, contents: string) => {
  const { WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS } = await getDirectSetting();
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

// 上传EPub文件有效
export const webdavUploadFile = async (filename: string, contents: string) => {
  const { WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS } = await getDirectSetting();
  const response = await fetch(`${WEBDAV_URL}${filename}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Authorization': 'Basic ' + btoa(`${WEBDAV_USER}:${WEBDAV_PASS}`)
    },
    body: Buffer.from(contents, 'base64')
  });

  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  console.log('webdavUploaded....');
};

export const webdavGet = async (filename: string) => {
  const { WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS } = await getDirectSetting();
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
  const { WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS } = await getDirectSetting();
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
  const { WEBDAV_URL, WEBDAV_USER, WEBDAV_PASS } = await getDirectSetting();
  if (!WEBDAV_URL) return;
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
    // 找到并删除所有后缀为epub的文件和与其同名的json文件
    const files = await RNFS.readDir(booksDir);
    await Promise.all(files.map(async file => {
      if (file.name.endsWith('.epub')) {
        await RNFS.unlink(file.path);
        // 删除同名json文件
        await RNFS.unlink(file.path.slice(0, -5) + '.json');
      }
    }));
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