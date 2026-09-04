import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Ionicons name="alert-circle-outline" size={64} color="#e50914" />
          <Text style={styles.title}>Bir Şeyler Yanlış Gitti</Text>
          <Text style={styles.message}>
            Uygulamada beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>Yenile</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0B',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    color: '#aaa',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#e50914',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
