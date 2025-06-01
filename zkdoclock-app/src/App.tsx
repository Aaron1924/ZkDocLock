import React, { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { Box, Button, Card, Container, Flex, Heading, Text } from '@radix-ui/themes';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { PACKAGE_ID } from './constants';
import CryptoJS from 'crypto-js';

function HomePage() {
    console.log('Rendering HomePage');
    return (
        <Card>
            <Flex direction="column" gap="3" align="center" p="4">
                <Heading size="5">ZkDocLock</Heading>
                <Text align="center">
                    Ứng dụng demo cho ZkDocLock, cho phép seller upload dữ liệu lên Walrus và lưu metadata trên blockchain.
                </Text>
                <Link to="/zkdoclock">
                    <Button size="3">Thử ngay</Button>
                </Link>
            </Flex>
        </Card>
    );
}

function ZkDocLockApp() {
    console.log('Rendering ZkDocLockApp');
    const currentAccount = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    // State cho việc upload record
    const [file, setFile] = useState<File | null>(null);
    const [metadata, setMetadata] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [txStatus, setTxStatus] = useState<string | null>(null);
    const [records, setRecords] = useState<{
        blobId: string;
        metadata: string;
        hash: string;
        timestamp: number;
        fileType: string;
    }[]>([]);

    if (!currentAccount) {
        return (
            <Flex justify="center" p="4">
                <Text>Vui lòng kết nối ví để tiếp tục</Text>
            </Flex>
        );
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        if (selectedFile) {
            if (selectedFile.size > 10 * 1024 * 1024) {
                alert('File size must be less than 10 MiB');
                return;
            }
            const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
            if (!allowedTypes.includes(selectedFile.type)) {
                alert('Chỉ hỗ trợ file ảnh (JPEG, PNG) hoặc PDF');
                return;
            }
            setFile(selectedFile);
        }
    };

    const handleUploadRecord = async () => {
        if (!file || !metadata) {
            alert('Vui lòng chọn file và nhập metadata');
            return;
        }
        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                if (event.target?.result instanceof ArrayBuffer) {
                    console.log('1. File read successfully');
                    const data = new Uint8Array(event.target.result);

                    // Tính hash của dữ liệu
                    const hash = CryptoJS.SHA256(CryptoJS.lib.WordArray.create(data)).toString();
                    console.log('2. Hash calculated:', hash);

                    // Upload lên Walrus
                    console.log('3. Starting upload to Walrus');
                    const response = await fetch('https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=1', {
                        method: 'PUT',
                        body: data,
                    });
                    console.log('4. Response from Walrus:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    const result = await response.json();
                    console.log('5. Result:', result);
                    let blobId;
                    if (result.newlyCreated) {
                        blobId = result.newlyCreated.blobObject.blobId;
                    } else if (result.alreadyCertified) {
                        blobId = result.alreadyCertified.blobId;
                    } else {
                        throw new Error('Unexpected response structure');
                    }
                    console.log('6. blobId:', blobId);

                    // Lấy timestamp và fileType
                    const timestamp = Date.now();
                    const fileType = file.type || 'unknown';
                    console.log('7. File type:', fileType);

                    // Hardcode proof, verifying key, and public inputs from successful Rust generation
                    const proofHex = "47cf851e8c1ba9cbfa1fb12386d3e51b54bfd3ad265ef0958f77953b59d611127bc0d298cd724fdd21eb9cd6ea58ac716101e40edd4320816aa178f1bd11f52715e2937ad973cc4753f6b7698a31cf0eca07904bba16fb702509661266bb4d21db31028d4794e09f71b3094abce44d5e7dff63ff60cdf4f3d7a0a4161bf70028";
                    const vkHex = "714a024c26c2dbb11ca76742d0122466b07369ad47ec14e048dd02af9dd77e0f059850d99f61d70b82651addbe50bb534ca2f361c64e4eb470d5822a1a7521260572b660641ac91c0dee8924a5e0b002f72741a3a1e7f3dc9bdf49c4e7762fa9eb41b25c85705b4641f6baf8838c91d45b7206edd1eaad8b95193993034d1a1398951a5403bc27ca2b30ecd13cfb512a79a5db6d7e0a179e82feb81df7f50d070c535f632f294c43dcb36f8988e66e51ca9c1760c5c31c871a72d0bf96984b3082762328c74c2423d7ad3f988c573a42a21e6fb8f11031e9a0898525ca310587020000000000000034370eadc947c62c52690af3db834df1721a74041acda3fa88a4e7c1e09172881b1656655149f0e1207940257fd58287563427777907bcd756f860fb6244e01e";
                    const publicInputsHex = "0900000000000000000000000000000000000000000000000000000000000000";

                    // Chuyển hex thành bytes
                    const proofBytes = hexToBytes(proofHex);
                    const vkBytes = hexToBytes(vkHex);
                    const publicInputsBytes = hexToBytes(publicInputsHex);

                    // Lưu record vào state
                    setRecords([...records, { blobId, metadata, hash, timestamp, fileType }]);

                    // Gọi smart contract với đầy đủ 8 tham số
                    console.log('8. Calling smart contract to create record');
                    const tx = new Transaction();
                    tx.moveCall({
                        target: `${PACKAGE_ID}::zk_doc_lock::create_record`,
                        arguments: [
                            tx.pure.vector('u8', Array.from(new TextEncoder().encode(blobId))), // blob_id
                            tx.pure.vector('u8', Array.from(hexToBytes(hash))), // file_hash
                            tx.pure.u64(timestamp), // data_timestamp
                            tx.pure.u64(file.size), // file_size
                            tx.pure.vector('u8', Array.from(new TextEncoder().encode(fileType))), // file_type
                            tx.pure.vector('u8', Array.from(proofBytes)), // proof
                            tx.pure.vector('u8', Array.from(vkBytes)), // verifying_key
                            tx.pure.vector('u8', Array.from(publicInputsBytes)), // public_inputs
                        ],
                    });
                    tx.setGasBudget(10000000);
                    signAndExecute(
                        { transaction: tx },
                        {
                            onSuccess: (result: any) => {
                                console.log('9. Record uploaded to blockchain:', result);
                                const createdObject = result.effects?.created?.find(
                                    (item: any) => item.owner && typeof item.owner === 'object' && 'Owned' in item.owner
                                );
                                const recordId = createdObject?.reference?.objectId || result.digest;
                                setTxStatus(`Record đã được tạo thành công: ${result.digest}, Record ID: ${recordId}`);
                            },
                            onError: (error: any) => {
                                console.error('10. Error uploading to blockchain:', error);
                                setTxStatus(`Lỗi khi upload lên blockchain: ${error.message}`);
                            },
                        }
                    );
                    setIsUploading(false);
                }
            };
            reader.readAsArrayBuffer(file);
        } catch (error: any) {
            console.error('Error during upload:', error);
            setTxStatus(`Lỗi khi upload lên Walrus: ${error.message}`);
            setIsUploading(false);
        }
    };

    // Hàm chuyển hex string thành bytes
    function hexToBytes(hex: string): Uint8Array {
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < hex.length; i += 2) {
            bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
        }
        return bytes;
    }

    return (
        <Container size="3" p="4">
            <Flex direction="column" gap="4">
                {/* Phần upload record */}
                <Card>
                    <Flex direction="column" gap="3" p="4">
                        <Heading size="4">Upload Record</Heading>
                        <input type="file" onChange={handleFileChange} accept="image/jpeg,image/png,application/pdf" />
                        <input
                            placeholder="Metadata (miêu tả dữ liệu)"
                            value={metadata}
                            onChange={(e) => setMetadata(e.target.value)}
                            style={{ padding: '8px', margin: '4px 0' }}
                        />
                        <Button onClick={handleUploadRecord} disabled={isUploading}>
                            {isUploading ? 'Đang upload...' : 'Upload Record'}
                        </Button>
                        {txStatus && <Text>{txStatus}</Text>}
                    </Flex>
                </Card>

                {/* Phần hiển thị danh sách record */}
                <Card>
                    <Flex direction="column" gap="3" p="4">
                        <Heading size="4">Danh sách Record</Heading>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr>
                                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Blob ID</th>
                                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Metadata</th>
                                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Hash</th>
                                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>Timestamp</th>
                                    <th style={{ border: '1px solid #ddd', padding: '8px' }}>File Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {records.map((record, index) => (
                                    <tr key={index}>
                                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.blobId}</td>
                                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.metadata}</td>
                                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.hash}</td>
                                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{new Date(record.timestamp).toLocaleString()}</td>
                                        <td style={{ border: '1px solid #ddd', padding: '8px' }}>{record.fileType}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Flex>
                </Card>
            </Flex>
        </Container>
    );
}

function App() {
    console.log('Rendering App');
    return (
        <Container>
            <Flex position="sticky" px="4" py="2" justify="between" align="center">
                <Heading size="6">ZkDocLock</Heading>
                <Box>
                    <ConnectButton />
                </Box>
            </Flex>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/zkdoclock" element={<ZkDocLockApp />} />
                </Routes>
            </BrowserRouter>
        </Container>
    );
}

export default App;