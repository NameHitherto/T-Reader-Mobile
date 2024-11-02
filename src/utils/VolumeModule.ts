import { NativeEventEmitter, NativeModules } from 'react-native';

const { VolumeModule } = NativeModules;
const volumeModuleEmitter = new NativeEventEmitter(VolumeModule);

type VolumeKeyPressCallback = (key: 'volume_up' | 'volume_down') => void;

export const addVolumeKeyPressListener = (callback: VolumeKeyPressCallback): (() => void) => {
  const subscription = volumeModuleEmitter.addListener('onVolumeKeyPress', callback);
  return () => subscription.remove();
};

export const getVolume = async (): Promise<number | void> => {
  try {
    const volume: number = await VolumeModule.getVolume();
    return volume;
  } catch (e) {
    console.error(e);
  }
};

export const setVolume = async (volume: number): Promise<void> => {
  try {
    await VolumeModule.setVolume(volume);
  } catch (e) {
    console.error(e);
  }
};

export const getKeyCode = async (): Promise<number | void> => {
  try {
    const keyCode: number = await VolumeModule.getKeyCode();
    return keyCode;
  } catch (e) {
    console.error(e);
  }
}

export const setKeyCode = async (keyCode: number): Promise<void> => {
  try {
    await VolumeModule.setKeyCode(keyCode);
  } catch (e) {
    console.error(e);
  }
};