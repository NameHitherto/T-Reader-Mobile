import * as RNFS from '@dr.pogodin/react-native-fs';
import { DOMParser } from 'xmldom';
import { Buffer } from 'buffer';
import { Setting, ModelRequestOptions, ModelMessage } from '../constant/type.map';
import { ChatMessage, ChatParams, ChatStreamResponse, OpenAIClient } from 'openai-fetch';
import { unzip } from 'react-native-zip-archive';

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

/**
 * 获取目标书籍的正文信息
 */
export const getEpubContent = async (filePath: string, length: number): Promise<string> => {
  try {
    // 验证文件存在
    if (!await RNFS.exists(filePath)) {
      return '';
    }
    // 创建临时解压目录
    const tempDir = `${RNFS.TemporaryDirectoryPath}/epub_extract_${Date.now()}`;
    await RNFS.mkdir(tempDir);

    try {
      let fullText = '';
      // 解压文件
      await unzip(filePath, tempDir);
      // 获取OPF文件
      const containerXmlPath = `${tempDir}/META-INF/container.xml`;
      if (!(await RNFS.exists(containerXmlPath))) {
        throw new Error('Invalid EPUB format: container.xml not found');
      }
      const containerXml = await RNFS.readFile(containerXmlPath);
      // 辅助函数，解析XML
      const parseXml = (xml: string): Promise<Document> => {
        return new Promise((resolve, reject) => {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(xml, 'application/xml');
          resolve(xmlDoc);
        });
      };
      const container = await parseXml(containerXml);
      const rootfile = container.getElementsByTagName('rootfile')[0];
      const opfPath = rootfile.getAttribute('full-path');
      const opfDir = opfPath?.split('/').slice(0, -1).join('/');

      // 读取OPF文件获取元数据和内容清单
      const opfContent = await RNFS.readFile(`${tempDir}/${opfPath}`);
      const opf = await parseXml(opfContent);

      // 提取章节内容
      const manifest = opf.getElementsByTagName('manifest')[0];
      const spine = opf.getElementsByTagName('spine')[0];

      // 遍历章节提取正文
      for (let i = 0; i < spine.childNodes.length; i++) {
        const itemref = spine.childNodes[i];
        if (itemref.nodeType === 1) { 
          const idref = (itemref as Element).getAttribute('idref');
          const item = Array.from(manifest.childNodes).find(node => {
            return node.nodeType === 1 && (node as Element).getAttribute('id') === idref;
          }) as Element;
          if (item) {
            const href = item.getAttribute('href');
            const content = await RNFS.readFile(`${tempDir}/${opfDir}/${href}`);
            // 简单的文本处理
            const plainText = content
              .replace(/<[^>]*>?/gm, ' ') // 移除HTML标签
              .replace(/\s+/g, ' ') // 合并多个空格
              .trim();

            fullText += plainText;
          }
        }
      }

      // 截取指定长度
      if (length > 0) {
        fullText = fullText.slice(0, length);
      }

      return fullText;
    } finally {
      // 删除临时目录
      await RNFS.unlink(tempDir);
    }
  }catch (error) {
    console.error('解压初始化错误', error);
    throw error;
  }
}

/**
 * 大模型问答
 * @param history 对话记录
 * @param stream 是否流式输出
 * @param bookInfo 书籍章节与正文内容
 * @param onUpdate 流式输出时内容更新回调
 * @param onComplete 对话结束回调
 * @param onError 错误回调
 */
export const askQuestion = async (
  requestOptions: ModelRequestOptions
): Promise<string> => {
  return callModelAPI(requestOptions);
};

/**
 * 发送请求到大模型API并获取回复，支持流式输出
 */
const callModelAPI = async (options: ModelRequestOptions): Promise<string> => {
  const setting = await readSetting();
  
  if (!setting.MODEL_BASE_URL || !setting.MODEL_API_KEY || !setting.MODEL_NAME) {
    throw new Error('大模型配置信息不完整，请检查setting.json文件');
  }

  // 优化提示词
  const prompt: ChatMessage = {
    role: 'system',
    content: '你是一名阅读助手，已知有一本书的内容如下，你需要据此回答用户的问题。\n' + options.bookInfo
  };
  
  try {
    // 创建OpenAI实例
    const openai = new OpenAIClient({
      apiKey: setting.MODEL_API_KEY,
      baseUrl: setting.MODEL_BASE_URL
    });

    // 推理内容，推理模型用
    let reasoningContent = '';
    // 回答内容
    let answerContent = '';
    // 是否正在回答
    let isAnswering = false;

    // 处理流式响应
    if (options.stream) {
      // 创建请求参数, 后续可补充更多参数
      // 目前RN不支持ReadableStream，暂等后续官方维护支持
      const readableStream: ChatStreamResponse = await openai.streamChatCompletion({
        model: setting.MODEL_NAME,
        messages: [prompt, ...options.messages],
      } as ChatParams);

      const reader = readableStream.getReader();

      async function read() {
        const { done, value } = await reader.read();
        if (done) {
          if (options.onComplete) {
            options.onComplete(answerContent);
          }
          return;
        }

        const content = value?.choices[0]?.delta?.content || '';
        if (content) {
          answerContent += content;
          if (options.onUpdate) {
            options.onUpdate(content);
          }
        }

        read();
      }

      isAnswering = true;

      // 开始读取
      read();
      
      return answerContent;
    } else {
      // 处理非流式响应
      const completion = await openai.createChatCompletion({
        model: setting.MODEL_NAME,
        messages: [prompt, ...options.messages],
      } as ChatParams);
      const content = completion.choices[0]?.message?.content || '';
      if (options.onComplete) {
        options.onComplete(content);
      }
      return content;
    }
  } catch (error) {
    console.error(error);
    if (options.onError) {
      options.onError(error);
    }
    throw error;
  }
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