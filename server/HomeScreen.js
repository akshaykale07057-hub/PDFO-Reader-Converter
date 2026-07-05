import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
// Import the sharing function we just created
import { shareRealFile } from './ShareService';

export default function DocumentCard({ item }) {
    return (
        <View style={styles.card}>
            {/* Share the converted PDF format */}
            {item.pdfFilename && (
                <Button
                    title="Share as PDF"
                    onPress={() => shareRealFile(item.pdfFilename)}
                    color="#25D366"
                />
            )}
            {/* Share the original file format (DOC, PPT, XLSX, EPUB, etc.) */}
            {item.filename && item.filename !== item.pdfFilename && (
                <View style={{ marginTop: 10 }}>
                    <Button
                        title={`Share Original ${item.filename.split('.').pop()?.toUpperCase() || ''}`}
                        onPress={() => shareRealFile(item.filename)}
                        color="#007AFF"
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    card: { padding: 20, marginVertical: 8, backgroundColor: '#fff', borderRadius: 8 }
});