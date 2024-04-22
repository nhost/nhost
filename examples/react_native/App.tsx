import React from 'react';
import {SafeAreaView, ScrollView, StyleSheet, Text, View} from 'react-native';

function App(): React.JSX.Element {
  return (
    <SafeAreaView>
      <ScrollView contentInsetAdjustmentBehavior="automatic">
        <Text>Sign Up</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sectionContainer: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  sectionDescription: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '400',
  },
  highlight: {
    fontWeight: '700',
  },
});

export default App;
