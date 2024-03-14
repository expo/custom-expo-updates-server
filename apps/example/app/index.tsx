import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { StyleSheet, Text, View, Image, Button } from 'react-native';

export default function App() {
  async function onFetchUpdateAsync() {
    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      }
    } catch (error) {
      // You can also add an alert() to see the error message in case of an error when fetching updates.
      alert(`Error fetching latest Expo update: ${error}`);
    }
  }

  return (
    <View style={styles.container}>
      <Text>Hello from Expo Updates!</Text>
      <Text>{Constants.expoConfig.name}</Text>
      <Image source={require('../assets/favicon.png')} />
      <Button title="Fetch update" onPress={onFetchUpdateAsync} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
