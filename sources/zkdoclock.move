module zkdoclock::zk_doc_lock {
    use sui::event;
    use sui::groth16;
    use sui::vec_set;

    // Error codes
    const ENotSeller: u64 = 1;
    const EInvalidProof: u64 = 2;
    const EAccessAlreadyGranted: u64 = 3;
    const ENotInAccessList: u64 = 4;

    // Structs with visibility
    public struct Record has key, store {
        id: object::UID,
        blob_id: vector<u8>,        // ID of encrypted data on Walrus
        id_rec: vector<u8>,         // Hash of the original document
        timestamp: u64,             // Timestamp when uploaded
        seller: address,            // Address of the seller
        proof: vector<u8>,          // ZKP-Groth16 proof
        access_list: vec_set::VecSet<address>, // Addresses granted access
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
        id_rec: vector<u8>,
        proof: vector<u8>,
        pvk_bytes: vector<u8>,
        public_inputs_bytes: vector<u8>,
        ctx: &mut tx_context::TxContext
    ) {
        let pvk = groth16::prepare_verifying_key(&groth16::bn254(), &pvk_bytes);
        let public_inputs = groth16::public_proof_inputs_from_bytes(public_inputs_bytes);
        let proof_points = groth16::proof_points_from_bytes(proof);

        let verified = groth16::verify_groth16_proof(
            &groth16::bn254(),
            &pvk,
            &public_inputs,
            &proof_points
        );
        assert!(verified, EInvalidProof);

        let record = Record {
            id: object::new(ctx),
            blob_id,
            id_rec,
            timestamp: tx_context::epoch_timestamp_ms(ctx),
            seller: tx_context::sender(ctx),
            proof,
            access_list: vec_set::empty(),
        };
        transfer::transfer(record, tx_context::sender(ctx));
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
}