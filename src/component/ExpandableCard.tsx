import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  TouchableOpacity, 
  StyleSheet, 
  Animated, 
  LayoutAnimation, 
  Platform,
  UIManager,
  Text,
  StyleProp,
  ViewStyle
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../styles/global';

// 启用 LayoutAnimation 在 Android 上工作
if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

interface ExpandableCardProps {
  title: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  headerStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<ViewStyle>;
  iconColor?: string;
  initialExpanded?: boolean;
  svgPath?: string;
  viewBox?: number;
}

const ExpandableCard: React.FC<ExpandableCardProps> = ({ 
  title, 
  children, 
  style, 
  headerStyle,
  contentStyle,
  titleStyle,
  iconColor = colors.darkGrey,
  initialExpanded = false,
  svgPath,
  viewBox = 24
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const rotateAnim = useRef(new Animated.Value(initialExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: expanded ? 1 : 0,
      duration: 300,
      useNativeDriver: true
    }).start();
  }, [expanded, rotateAnim]);

  const toggleExpand = () => {
    // 配置动画
    LayoutAnimation.configureNext({
      duration: 300,
      update: {
        type: LayoutAnimation.Types.easeInEaseOut,
      },
    });
    setExpanded(!expanded);
  };

  // 计算旋转角度
  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg']
  });

  return (
    <View style={[styles.container, style]}>
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={toggleExpand}
        style={[styles.header, headerStyle]}
      >
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
            {svgPath && (
                <Svg width={28} height={28} viewBox={`0 0 ${viewBox} ${viewBox}`}>
                    <Path strokeWidth={0} d={svgPath}/>
                </Svg>
            )}
            <Text style={[styles.title, titleStyle]}>{title}</Text>
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path
              d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"
              fill={iconColor}
            />
          </Svg>
        </Animated.View>
      </TouchableOpacity>
      
      {expanded && (
        <View style={[styles.content, contentStyle]}>
          {children}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: 16,
    color: colors.black,
    lineHeight: 18,
    alignContent: 'center',
  },
  content: {
    padding: 16,
    paddingTop: 0,
  },
});

export default ExpandableCard;