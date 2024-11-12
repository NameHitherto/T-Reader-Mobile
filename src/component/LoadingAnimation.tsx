import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Modal from 'react-native-modal';
import LottieView from 'lottie-react-native';

// 定义动画类型
type AnimationType = 'text' | 'file' | 'dot' | 'dot-up' | 'book' | 'roxy';

// 定义组件参数
// 后续增加更多可选参数
interface LoadingAnimationProps {
    isVisible: boolean;
    onBackdropPress: () => void;
    animationType: AnimationType;
    message?: string;
}

// 定义动画资源映射
const animationSourceMap: Record<AnimationType, any> = {
    text: require('../animation/loading-text.json'),
    file: require('../animation/loading-file.json'),
    dot: require('../animation/loading-dot.json'),
    "dot-up": require('../animation/loading-dot-up.json'),
    book: require('../animation/loading-book.json'),
    roxy: require('../animation/loading-roxy.json'),
};

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ isVisible, onBackdropPress, animationType, message }) => {
    return (
        <Modal
            isVisible={isVisible}
            onBackdropPress={onBackdropPress}
            backdropOpacity={0.6}
            animationIn="fadeIn"
            animationOut="fadeOut"
            style={styles.modal}
        >
            <View style={styles.container}>
                <View style={styles.lottieContainer}>
                    <LottieView
                        source={animationSourceMap[animationType]}
                        autoPlay
                        loop
                        style={styles.lottie}
                    />
                </View>
                {message && <Text style={styles.message}>{message}</Text>}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modal: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        padding: 20,
        alignItems: 'center',
    },
    lottieContainer: {
        width: 150,
        height: 150,
        borderRadius: 100,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    lottie: {
        width: '100%',
        height: '100%',
        borderRadius: 100,
    },
    message: {
        marginTop: 5,
        fontSize: 16,
        color: '#ffec3d',
        textAlign: 'center',
        fontFamily: 'fantasy',
    },
});

export default LoadingAnimation;
export type { AnimationType };
