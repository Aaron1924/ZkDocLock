import React, { useState } from 'react';
import { Transaction } from '@mysten/sui/transactions';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { ConnectButton } from '@mysten/dapp-kit';
import { Box, Button, Card, Container, Flex, Heading, Text, TextField } from '@radix-ui/themes';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

function HomePage() {
    return (
        <Card>
            <Flex direction="column" gap="3" align="center" p="4">
                <Heading size="5">ZkDocLock Example</Heading>
                <Text align="center">
                    Đây là một ứng dụng demo cho ZkDocLock, cho phép seller tạo record với dữ liệu mã hóa trên Walrus,
                    quản lý danh sách truy cập, và buyer yêu cầu quyền truy cập vào dữ liệu.
                </Text>
                <Link to="/zkdoclock">
                    <Button size="3">Thử ngay</Button>
                </Link>
            </Flex>
        </Card>
    );
}

function ZkDocLockApp() {
    const suiClient = useSuiClient();
    const currentAccount = useCurrentAccount();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    // State cho việc tạo record
    const [blobId, setBlobId] = useState('');
    const [hash, setHash] = useState('');
    const [proof, setProof] = useState('');
    const [pvkBytes, setPvkBytes] = useState('');
    const [publicInputsBytes, setPublicInputsBytes] = useState('');
    const [buyers, setBuyers] = useState<string[]>([]);
    const [recordId, setRecordId] = useState('');

    // State cho việc thêm buyer
    const [newBuyerAddress, setNewBuyerAddress] = useState('');

    // State cho việc yêu cầu truy cập
    const [buyerPublicKey, setBuyerPublicKey] = useState('');

    // State để hiển thị trạng thái giao dịch
    const [txStatus, setTxStatus] = useState<string | null>(null);

    if (!currentAccount) {
        return (
            <Flex justify="center" p="4">
                <Text>Vui lòng kết nối ví để tiếp tục</Text>
            </Flex>
        );
    }

    // Hàm tạo record
    const handleCreateRecord = () => {
        const tx = new Transaction();
        tx.moveCall({
            target: '0xYOUR_PACKAGE_ID::zk_doc_lock::create_record',
            arguments: [
                tx.pure.vector('u8', blobId.split(',').map(Number)),
                tx.pure.vector('u8', hash.split(',').map(Number)),
                tx.pure.vector('u8', proof.split(',').map(Number)),
                tx.pure.vector('u8', pvkBytes.split(',').map(Number)),
                tx.pure.vector('u8', publicInputsBytes.split(',').map(Number)),
                tx.pure.vector('address', buyers),
            ],
        });
        tx.setGasBudget(10000000);
        signAndExecute(
            { transaction: tx },
            {
                onSuccess: (result) => {
                    setTxStatus(`Record đã được tạo thành công: ${result.digest}`);
                    // Giả sử digest có thể dùng để lấy recordId trong thực tế
                    setRecordId(result.digest); // Điều chỉnh theo cách lấy ID thực tế
                },
                onError: (error) => setTxStatus(`Lỗi khi tạo record: ${error.message}`),
            }
        );
    };

    // Hàm thêm buyer vào danh sách truy cập
    const handleAddToAccessList = () => {
        const tx = new Transaction();
        tx.moveCall({
            target: '0xYOUR_PACKAGE_ID::zk_doc_lock::add_to_access_list',
            arguments: [
                tx.object(recordId),
                tx.pure.address(newBuyerAddress),
            ],
        });
        tx.setGasBudget(10000000);
        signAndExecute(
            { transaction: tx },
            {
                onSuccess: (result) => setTxStatus(`Buyer đã được thêm: ${result.digest}`),
                onError: (error) => setTxStatus(`Lỗi khi thêm buyer: ${error.message}`),
            }
        );
    };

    // Hàm yêu cầu truy cập
    const handleRequestAccess = () => {
        const tx = new Transaction();
        tx.moveCall({
            target: '0xYOUR_PACKAGE_ID::zk_doc_lock::request_access',
            arguments: [
                tx.object(recordId),
                tx.pure.vector('u8', buyerPublicKey.split(',').map(Number)),
            ],
        });
        tx.setGasBudget(10000000);
        signAndExecute(
            { transaction: tx },
            {
                onSuccess: (result) => setTxStatus(`Yêu cầu truy cập đã được gửi: ${result.digest}`),
                onError: (error) => setTxStatus(`Lỗi khi gửi yêu cầu: ${error.message}`),
            }
        );
    };

    return (
        <Container size="3" p="4">
            <Flex direction="column" gap="4">
                {/* Phần tạo record */}
                <Card>
                    <Flex direction="column" gap="3" p="4">
                        <Heading size="4">Tạo Record</Heading>
                        <TextField.Input
                            placeholder="Blob ID (phân tách bằng dấu phẩy)"
                            value={blobId}
                            onChange={(e) => setBlobId(e.target.value)}
                        />
                        <TextField.Input
                            placeholder="Hash (phân tách bằng dấu phẩy)"
                            value={hash}
                            onChange={(e) => setHash(e.target.value)}
                        />
                        <TextField.Input
                            placeholder="Proof (phân tách bằng dấu phẩy)"
                            value={proof}
                            onChange={(e) => setProof(e.target.value)}
                        />
                        <TextField.Input
                            placeholder="PVK Bytes (phân tách bằng dấu phẩy)"
                            value={pvkBytes}
                            onChange={(e) => setPvkBytes(e.target.value)}
                        />
                        <TextField.Input
                            placeholder="Public Inputs Bytes (phân tách bằng dấu phẩy)"
                            value={publicInputsBytes}
                            onChange={(e) => setPublicInputsBytes(e.target.value)}
                        />
                        <TextField.Input
                            placeholder="Danh sách buyer ban đầu (địa chỉ, phân tách bằng dấu phẩy)"
                            value={buyers.join(',')}
                            onChange={(e) => setBuyers(e.target.value.split(','))}
                        />
                        <Button onClick={handleCreateRecord}>Tạo Record</Button>
                    </Flex>
                </Card>

                {/* Phần thêm buyer */}
                <Card>
                    <Flex direction="column" gap="3" p="4">
                        <Heading size="4">Thêm Buyer vào Access List</Heading>
                        <TextField.Input
                            placeholder="Record ID"
                            value={recordId}
                            onChange={(e) => setRecordId(e.target.value)}
                        />
                        <TextField.Input
                            placeholder="Địa chỉ Buyer"
                            value={newBuyerAddress}
                            onChange={(e) => setNewBuyerAddress(e.target.value)}
                        />
                        <Button onClick={handleAddToAccessList}>Thêm Buyer</Button>
                    </Flex>
                </Card>

                {/* Phần yêu cầu truy cập */}
                <Card>
                    <Flex direction="column" gap="3" p="4">
                        <Heading size="4">Yêu cầu Truy Cập</Heading>
                        <TextField.Input
                            placeholder="Record ID"
                            value={recordId}
                            onChange={(e) => setRecordId(e.target.value)}
                        />
                        <TextField.Input
                            placeholder="Public Key của Buyer (phân tách bằng dấu phẩy)"
                            value={buyerPublicKey}
                            onChange={(e) => setBuyerPublicKey(e.target.value)}
                        />
                        <Button onClick={handleRequestAccess}>Yêu cầu Truy Cập</Button>
                    </Flex>
                </Card>

                {/* Hiển thị trạng thái giao dịch */}
                {txStatus && (
                    <Card>
                        <Text>{txStatus}</Text>
                    </Card>
                )}
            </Flex>
        </Container>
    );
}

function App() {
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