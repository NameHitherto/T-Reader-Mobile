import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../styles/global';

// 目录项类型定义
export interface TocItem {
  id?: string;
  href: string;
  label: string;
  subitems?: TocItem[];
  level?: number;
  parent?: string;
}

// 扁平化目录项类型（用于FlatList渲染）
interface FlattenedTocItem extends TocItem {
  id: string;
  level: number;
  parent: string;
  hasChildren: boolean;
  isVisible: boolean;
  isExpanded: boolean;
}

interface TocListProps {
  toc: TocItem[];
  textColor: string;
  currentChapter: string;
  onItemPress: (href: string) => void;
}

const TocList: React.FC<TocListProps> = ({ toc, textColor, currentChapter, onItemPress }) => {
  // 扁平化的目录数据
  const flattenedToc = useRef<FlattenedTocItem[]>([]);
  // 章节列表，用于触发渲染
  const [tocList, setTocList] = useState<FlattenedTocItem[]>([]);
  // FlatList的引用
  const flatListRef = useRef<FlatList>(null);
  // FlatList每个章节的高度 - padding(16) * 2 + lineHeight(20) + borderBottom(1) = 53
  const ITEM_HEIGHT = 53; 

  // 首次加载时初始化数据
  // 将多层级目录扁平化处理，便于FlatList渲染
  useEffect(() => {
    flattenedToc.current = [];

    const flattenToc = (
      items: TocItem[], 
      level: number = 0, 
      parent: string = 'root',
      isVisible: boolean = true,
      isExpanded: boolean = false,
    ) => {
      items.forEach((item, index) => {
        const id = `${parent}-${index}`;
        const hasChildren = !!(item.subitems && item.subitems.length > 0);
        
        flattenedToc.current.push({
          ...item,
          id,
          level,
          parent,
          hasChildren,
          isVisible,
          isExpanded,
        });
        
        if (hasChildren && item.subitems) {
          // 子项默认不展开
          flattenToc(item.subitems, level + 1, id, false, false);
        }
      });
    };
    // 初始化目录
    flattenToc(toc);
    // 展开当前章节的父章节
    const currentItem = flattenedToc.current.find(item => item.href === currentChapter);
    let currentParent = currentItem?.parent;
    while (currentParent && currentParent !== 'root') {
      flattenedToc.current.map((item) => {
        if (item.id.startsWith(currentParent + '-')) {
          item.isVisible = true;
        }
      });
      const upperParent = flattenedToc.current.find((item) => {
        if (item.id === currentParent) {
          item.isVisible = true;
          item.isExpanded = true;
          return item;
        }
      })
      currentParent = upperParent?.parent;
    }
    // 渲染目录数据
    setTocList(flattenedToc.current);
    // 滚动到当前章节
    handleScrollToIndex();
  }, []);

  // 切换章节展开/折叠状态
  const toggleChapter = (id: string) => {
    const toc = flattenedToc.current.find(item => item.id === id);
    if (!toc) return;
    if (toc.isExpanded) {
      // 此时折叠章节
      toc.isExpanded = false;
      flattenedToc.current.map((item) => {
        if (item.id.startsWith(id + '-')) {
          item.isVisible = false;
          item.isExpanded = false;
        }
      })
    } else {
      // 此时展开章节
      toc.isExpanded = true;
      flattenedToc.current.map((item) => {
        if (item.parent === id) {
          item.isVisible = true;
        }
      })
    }
    // 更新章节列表
    setTocList([...flattenedToc.current]);
  };

  // 清理标签文本
  const cleanTocLabel = (label: string): string => {
    return label.replace(/\s+/g, ' ').trim();
  };

  // 滚动到当前章节
  const handleScrollToIndex = () => {
    const index = flattenedToc.current.filter(item => item.isVisible).findIndex(item => item.href === currentChapter);
    if (index === -1 || !flatListRef.current) return;
    
    setTimeout(() => {
      try {
        if (flatListRef.current) {
          flatListRef.current.scrollToIndex({
            index,
            animated: false,
            viewPosition: 0,
          });
        } else {
          handleScrollToIndex();
        }
      } catch (error) {
        console.log('Failed to scroll:', error);
      }
    }, 500); 
  };

  const renderItem = ({ item }: { item: FlattenedTocItem }) => {
    if (!item.isVisible) return null;

    return (
      <TouchableOpacity 
        onPress={() => {
          if (item.hasChildren) {
            toggleChapter(item.id);
          } else {
            onItemPress(item.href);
          }
        }}
        style={[
          styles.item, 
          { paddingLeft: 16 + item.level * 20 }
        ]}
      >
        {item.hasChildren && (
          <Svg width="16" height="16" viewBox="0 0 24 24" style={styles.icon}>
            <Path 
              fill={textColor} 
              d={item.isExpanded 
                ? "M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" 
                : "M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"} 
            />
          </Svg>
        )}
        <Text 
          style={[
            styles.label, 
            { color: textColor },
            item.hasChildren && styles.chapterTitle,
            item.href === currentChapter && styles.activeChapter
          ]}
        >
          {cleanTocLabel(item.label)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      ref={flatListRef}
      data={tocList.filter(item => item.isVisible)}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      initialNumToRender={20}
      windowSize={10}
      maxToRenderPerBatch={20}
      getItemLayout={(data, index) => (
        { length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index } 
      )}
    />
  );
};

const styles = StyleSheet.create({
  item: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    gap: 6,
    padding: 16,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderBottomColor: colors.lightNeutral,
  },
  label: {
    flex: 1,
    lineHeight: 20,
    fontSize: 14,
    textAlign: 'left',
  },
  chapterTitle: {
    fontWeight: 'bold',
  },
  activeChapter: {
    color: colors.chapterHighlight,
  },
  icon: {
    marginRight: 4,
  }
});

export default TocList;