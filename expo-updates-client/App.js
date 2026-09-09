import { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';

function stringify(value) {
  return JSON.stringify(
    value,
    (_key, item) => {
      if (item instanceof Error) {
        return {
          name: item.name,
          message: item.message,
          stack: item.stack,
        };
      }
      if (item instanceof Date) {
        return item.toISOString();
      }
      return item;
    },
    2,
  );
}

function ActionButton({ label, onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const updateState = Updates.useUpdates();
  const [extraParam, setExtraParam] = useState('local');
  const [output, setOutput] = useState('Select an action to exercise the expo-updates API.');
  const serverUrl = Constants.expoConfig?.extra?.localUpdatesServerUrl;
  const channel = Constants.expoConfig?.extra?.localUpdatesChannel || 'main';

  async function run(label, action) {
    try {
      const result = await action();
      setOutput(`${label}\n${stringify(result ?? { ok: true })}`);
    } catch (error) {
      setOutput(`${label} failed\n${stringify(error)}`);
    }
  }

  const constants = {
    isEnabled: Updates.isEnabled,
    updateId: Updates.updateId,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    checkAutomatically: Updates.checkAutomatically,
    createdAt: Updates.createdAt,
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    isEmergencyLaunch: Updates.isEmergencyLaunch,
    emergencyLaunchReason: Updates.emergencyLaunchReason,
    launchDuration: Updates.launchDuration,
    manifest: Updates.manifest,
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Expo Updates SDK 57</Text>
        <Text style={styles.subtitle}>
          Custom protocol server and public API diagnostics
        </Text>

        <View style={styles.card}>
          <Text style={styles.heading}>Runtime constants</Text>
          <Text selectable style={styles.code}>
            {stringify(constants)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Live useUpdates state</Text>
          <Text selectable style={styles.code}>
            {stringify(updateState)}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Update lifecycle</Text>
          <View style={styles.actions}>
            <ActionButton
              label="Check"
              onPress={() => run('checkForUpdateAsync', Updates.checkForUpdateAsync)}
            />
            <ActionButton
              label="Fetch"
              onPress={() => run('fetchUpdateAsync', Updates.fetchUpdateAsync)}
            />
            <ActionButton
              label="Reload"
              onPress={() =>
                run('reloadAsync', () =>
                  Updates.reloadAsync({
                    reloadScreenOptions: {
                      backgroundColor: '#111827',
                      spinner: { color: '#60a5fa', size: 'large' },
                      fade: true,
                    },
                  }),
                )
              }
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Extra parameters</Text>
          <TextInput
            accessibilityLabel="Extra parameter value"
            autoCapitalize="none"
            onChangeText={setExtraParam}
            style={styles.input}
            value={extraParam}
          />
          <View style={styles.actions}>
            <ActionButton
              label="Set cohort"
              onPress={() =>
                run('setExtraParamAsync', () =>
                  Updates.setExtraParamAsync('cohort', extraParam),
                )
              }
            />
            <ActionButton
              label="Read"
              onPress={() => run('getExtraParamsAsync', Updates.getExtraParamsAsync)}
            />
            <ActionButton
              label="Clear cohort"
              onPress={() =>
                run('setExtraParamAsync(null)', () =>
                  Updates.setExtraParamAsync('cohort', null),
                )
              }
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Logs</Text>
          <View style={styles.actions}>
            <ActionButton
              label="Read logs"
              onPress={() => run('readLogEntriesAsync', Updates.readLogEntriesAsync)}
            />
            <ActionButton
              label="Clear logs"
              onPress={() => run('clearLogEntriesAsync', Updates.clearLogEntriesAsync)}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Runtime overrides</Text>
          <Text style={styles.note}>
            These controls are enabled only for this local diagnostic build.
          </Text>
          <View style={styles.actions}>
            <ActionButton
              label="Override headers"
              onPress={() =>
                run('setUpdateRequestHeadersOverride', () =>
                  Updates.setUpdateRequestHeadersOverride({
                    'expo-channel-name': channel,
                    'x-local-override': 'true',
                  }),
                )
              }
            />
            <ActionButton
              label="Override URL"
              onPress={() =>
                run('setUpdateURLAndRequestHeadersOverride', () =>
                  Updates.setUpdateURLAndRequestHeadersOverride({
                    updateUrl: serverUrl,
                    requestHeaders: {
                      'expo-channel-name': channel,
                      'x-local-override': 'true',
                    },
                  }),
                )
              }
            />
            <ActionButton
              label="Clear overrides"
              onPress={() =>
                run('clear overrides', () => {
                  Updates.setUpdateRequestHeadersOverride(null);
                  Updates.setUpdateURLAndRequestHeadersOverride(null);
                })
              }
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Reload screen</Text>
          <View style={styles.actions}>
            <ActionButton
              label="Show"
              onPress={() =>
                run('showReloadScreen', () =>
                  Updates.showReloadScreen({
                    reloadScreenOptions: {
                      backgroundColor: '#111827',
                      spinner: { color: '#60a5fa', size: 'large' },
                    },
                  }),
                )
              }
            />
            <ActionButton
              label="Hide"
              onPress={() => run('hideReloadScreen', Updates.hideReloadScreen)}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>Last action</Text>
          <Text selectable style={styles.code}>
            {output}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 18,
    gap: 14,
  },
  title: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  heading: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '600',
  },
  note: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  code: {
    color: '#bfdbfe',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  buttonPressed: {
    backgroundColor: '#1d4ed8',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#0f172a',
    borderColor: '#475569',
    borderRadius: 8,
    borderWidth: 1,
    color: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
