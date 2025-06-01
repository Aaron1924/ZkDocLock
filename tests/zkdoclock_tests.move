#[test_only]
module zkdoclock::zkdoclock_tests;

use zkdoclock::zk_doc_lock;
use sui::test_scenario;

#[test]
fun test_create_record() {
    let user = @0x1;
    let mut scenario = test_scenario::begin(user);
    
    // Test data from Rust zkproof generation
    let proof = x"47cf851e8c1ba9cbfa1fb12386d3e51b54bfd3ad265ef0958f77953b59d611127bc0d298cd724fdd21eb9cd6ea58ac716101e40edd4320816aa178f1bd11f52715e2937ad973cc4753f6b7698a31cf0eca07904bba16fb702509661266bb4d21db31028d4794e09f71b3094abce44d5e7dff63ff60cdf4f3d7a0a4161bf70028";
    let vk = x"714a024c26c2dbb11ca76742d0122466b07369ad47ec14e048dd02af9dd77e0f059850d99f61d70b82651addbe50bb534ca2f361c64e4eb470d5822a1a7521260572b660641ac91c0dee8924a5e0b002f72741a3a1e7f3dc9bdf49c4e7762fa9eb41b25c85705b4641f6baf8838c91d45b7206edd1eaad8b95193993034d1a1398951a5403bc27ca2b30ecd13cfb512a79a5db6d7e0a179e82feb81df7f50d070c535f632f294c43dcb36f8988e66e51ca9c1760c5c31c871a72d0bf96984b3082762328c74c2423d7ad3f988c573a42a21e6fb8f11031e9a0898525ca310587020000000000000034370eadc947c62c52690af3db834df1721a74041acda3fa88a4e7c1e09172881b1656655149f0e1207940257fd58287563427777907bcd756f860fb6244e01e";
    let public_inputs = x"0900000000000000000000000000000000000000000000000000000000000000";
    
    // Enhanced metadata for the document
    let blob_id = b"https://walrus.site/test";
    let file_hash = b"test_document_hash_sha256";
    let data_timestamp = 1234567890000u64;  // Example timestamp in milliseconds
    let file_size = 2048u64;  // Example file size in bytes
    let file_type = b"application/pdf";  // Example MIME type
    
    // Create record should succeed with valid proof
    zk_doc_lock::create_record(
        blob_id,
        file_hash,
        data_timestamp,
        file_size,
        file_type,
        proof,
        vk,
        public_inputs,
        scenario.ctx()
    );
    
    scenario.end();
}

#[test, expected_failure(abort_code = 0)]
fun test_create_record_invalid_proof() {
    let user = @0x1;
    let mut scenario = test_scenario::begin(user);
    
    // Invalid proof data (will fail at prepare_verifying_key step)
    let proof = x"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    let vk = x"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    let public_inputs = x"0900000000000000000000000000000000000000000000000000000000000000";
    
    // Enhanced metadata for the document
    let blob_id = b"https://walrus.site/test";
    let file_hash = b"test_document_hash_sha256";
    let data_timestamp = 1234567890000u64;  // Example timestamp in milliseconds
    let file_size = 2048u64;  // Example file size in bytes
    let file_type = b"application/pdf";  // Example MIME type
    
    // Should fail with invalid verifying key
    zk_doc_lock::create_record(
        blob_id,
        file_hash,
        data_timestamp,
        file_size,
        file_type,
        proof,
        vk,
        public_inputs,
        scenario.ctx()
    );
    
    scenario.end();
}
