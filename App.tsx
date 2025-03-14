import * as React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack';
import HomeScreen from './src/screens/HomeScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import SettingScreen from './src/screens/SettingScreen';
import { ReaderProvider } from '@epubjs-react-native/core';
import { RootStackParamList } from './src/route/navigation-types';

const Stack = createStackNavigator<RootStackParamList>();

function App() {
  return (
    <ReaderProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName="Home" screenOptions={{headerShown: false}}>
          <Stack.Screen 
            name="Home" 
            component={HomeScreen} 
            options={{cardStyleInterpolator: CardStyleInterpolators.forNoAnimation}}
          />
          <Stack.Screen 
            name="Reader" 
            component={ReaderScreen} 
            options={{cardStyleInterpolator: CardStyleInterpolators.forScaleFromCenterAndroid}}
          />
          <Stack.Screen 
            name="Setting" 
            component={SettingScreen} 
            options={{cardStyleInterpolator: CardStyleInterpolators.forNoAnimation}}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </ReaderProvider>
  );
}

export default App;