module zkdoclock::zk_doc_lock {
    use sui::event;
    use sui::groth16;
    use sui::vec_set;
    //use sui::object;
    //use sui::tx_context;
    //use sui::transfer;

    // Error codes
    const ENotSeller: u64 = 1;
    const EInvalidProof: u64 = 2;
    const EAccessAlreadyGranted: u64 = 3;
    const ENotInAccessList: u64 = 4;

    // Structs with visibility
    public struct Record has key, store {
        id: object::UID,
        blob_id: vector<u8>,        // ID of encrypted data on Walrus
        file_hash: vector<u8>,      // Hash of the original document (SHA-256)
        data_timestamp: u64,        // Timestamp of the data creation
        upload_timestamp: u64,      // Timestamp when uploaded to blockchain
        seller: address,            // Address of the seller
        proof: vector<u8>,          // ZKP-Groth16 proof
        access_list: vec_set::VecSet<address>, // Addresses granted access
        file_size: u64,             // Size of original file in bytes
        file_type: vector<u8>,      // MIME type of the file
    }

    // Event emitted when a new record is created
    public struct RecordCreated has copy, drop {
        record_id: object::ID,
        file_hash: vector<u8>,
        data_timestamp: u64,
        upload_timestamp: u64,
        seller: address,
        file_size: u64,
    }

    public struct AccessRequested has copy, drop {
        record_id: object::ID,
        buyer: address,
        buyer_public_key: vector<u8>,
    }

    public struct AccessApproved has copy, drop {
        record_id: object::ID,
        buyer: address,
        encrypted_key: vector<u8>,
    }

    // Create a record with proof verification
    public entry fun create_record(
        blob_id: vector<u8>,
        file_hash: vector<u8>,
        data_timestamp: u64,
        file_size: u64,
        file_type: vector<u8>,
        proof: vector<u8>,
        verifying_key: vector<u8>,
        public_inputs: vector<u8>,
        ctx: &mut tx_context::TxContext
    ) {
        // Use the provided verifying key instead of hardcoded
        let pvk = groth16::prepare_verifying_key(
            &groth16::bn254(),
            &verifying_key
        );

        // Use the provided public inputs instead of hardcoded
        let public_proof_inputs = groth16::public_proof_inputs_from_bytes(
            public_inputs
        );

        // Use the provided proof instead of hardcoded
        let proof_points = groth16::proof_points_from_bytes(
            proof
        );

        // Verify proof
        let verified = groth16::verify_groth16_proof(
            &groth16::bn254(),
            &pvk,
            &public_proof_inputs,
            &proof_points
        );
        assert!(verified, EInvalidProof);

        let upload_timestamp = tx_context::epoch_timestamp_ms(ctx);
        let seller = tx_context::sender(ctx);

        let record = Record {
            id: object::new(ctx),
            blob_id,
            file_hash,
            data_timestamp,
            upload_timestamp,
            seller,
            proof,
            access_list: vec_set::empty(),
            file_size,
            file_type,
        };

        let record_id = object::id(&record);

        // Emit event with hash and timestamp data
        event::emit(RecordCreated {
            record_id,
            file_hash,
            data_timestamp,
            upload_timestamp,
            seller,
            file_size,
        });

        transfer::transfer(record, seller);
    }

    // Seller adds a buyer to the access_list
    public entry fun add_to_access_list(
        record: &mut Record,
        buyer: address,
        ctx: &mut tx_context::TxContext
    ) {
        assert!(record.seller == tx_context::sender(ctx), ENotSeller);
        assert!(!vec_set::contains(&record.access_list, &buyer), EAccessAlreadyGranted);
        vec_set::insert(&mut record.access_list, buyer);
    }

    // Request access to a record
    public entry fun request_access(
        record_id: object::ID,
        buyer_public_key: vector<u8>,
        ctx: &mut tx_context::TxContext
    ) {
        event::emit(AccessRequested {
            record_id,
            buyer: tx_context::sender(ctx),
            buyer_public_key,
        });
    }

    // Approve access to a buyer
    public entry fun approve_access(
        record: &mut Record,
        buyer: address,
        encrypted_key_for_buyer: vector<u8>,
        ctx: &mut tx_context::TxContext
    ) {
        assert!(record.seller == tx_context::sender(ctx), ENotSeller);
        assert!(vec_set::contains(&record.access_list, &buyer), ENotInAccessList);
        event::emit(AccessApproved {
            record_id: object::id(record),
            buyer,
            encrypted_key: encrypted_key_for_buyer,
        });
    }

    // Verify proof of a record
    public fun verify_proof(
        record: &Record,
        pvk_bytes: vector<u8>,
        public_inputs_bytes: vector<u8>
    ): bool {
        let pvk = groth16::prepare_verifying_key(&groth16::bn254(), &pvk_bytes);
        let public_inputs = groth16::public_proof_inputs_from_bytes(public_inputs_bytes);
        let proof_points = groth16::proof_points_from_bytes(record.proof);

        groth16::verify_groth16_proof(
            &groth16::bn254(),
            &pvk,
            &public_inputs,
            &proof_points
        )
    }

    // Check if a buyer is in the access_list
    public fun check_access(record: &Record, buyer: address): bool {
        vec_set::contains(&record.access_list, &buyer)
    }

    // Getter functions for record data
    public fun get_file_hash(record: &Record): vector<u8> {
        record.file_hash
    }

    public fun get_data_timestamp(record: &Record): u64 {
        record.data_timestamp
    }

    public fun get_upload_timestamp(record: &Record): u64 {
        record.upload_timestamp
    }

    public fun get_file_size(record: &Record): u64 {
        record.file_size
    }

    public fun get_file_type(record: &Record): vector<u8> {
        record.file_type
    }

    public fun get_seller(record: &Record): address {
        record.seller
    }

    public fun get_blob_id(record: &Record): vector<u8> {
        record.blob_id
    }
}