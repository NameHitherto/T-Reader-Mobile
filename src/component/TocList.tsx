import React, { useState, useEffect } from 'react';
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
  isActive: boolean;
}

interface TocListProps {
  toc: TocItem[];
  textColor: string;
  currentChapter: string;
  onItemPress: (href: string) => void;
}

const TocList: React.FC<TocListProps> = ({ toc, textColor, currentChapter, onItemPress }) => {
  // 追踪展开状态的章节ID
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({});
  // 扁平化的目录数据
  const [flattenedToc, setFlattenedToc] = useState<FlattenedTocItem[]>([]);

  // 将多层级目录扁平化处理，便于FlatList渲染
  useEffect(() => {
    const flattened: FlattenedTocItem[] = [];
    
    const flattenToc = (
      items: TocItem[], 
      level: number = 0, 
      parent: string = 'root',
      isVisible: boolean = true,
    ) => {
      items.forEach((item, index) => {
        const id = `${parent}-${index}`;
        const hasChildren = !!(item.subitems && item.subitems.length > 0);
        const isActive = item.href === currentChapter;
        
        flattened.push({
          ...item,
          id,
          level,
          parent,
          hasChildren,
          isVisible,
          isActive,
        });
        
        if (hasChildren && item.subitems) {
          // 子项是否可见取决于父项是否展开
          const childrenVisible = isVisible && !!expandedChapters[id];
          flattenToc(item.subitems, level + 1, id, childrenVisible);
        }
      });
    };
    
    flattenToc(toc);
    setFlattenedToc(flattened);
  }, [toc, expandedChapters, currentChapter]);

  // 切换章节展开/折叠状态
  const toggleChapter = (id: string) => {
    setExpandedChapters(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // 清理标签文本
  const cleanTocLabel = (label: string): string => {
    return label.replace(/\s+/g, ' ').trim();
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
              d={expandedChapters[item.id] 
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
            item.isActive && styles.activeChapter
          ]}
        >
          {cleanTocLabel(item.label)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <FlatList
      data={flattenedToc.filter(item => item.isVisible)}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      initialNumToRender={20}
      windowSize={10}
      maxToRenderPerBatch={20}
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