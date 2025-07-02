import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { LobbyScreen } from './app/LobbyScreen';
import { GameScreen } from './app/GameScreen';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="light" backgroundColor="#1B5E20" />
      <Stack.Navigator
        initialRouteName="Lobby"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#1B5E20',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen 
          name="Lobby" 
          component={LobbyScreen}
          options={{ title: 'Mei-Tra' }}
        />
        <Stack.Screen 
          name="Game" 
          component={GameScreen}
          options={{ title: 'Game Room' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}