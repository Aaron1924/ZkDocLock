use ark_bn254::{Bn254, Fr};
use ark_circom::{CircomBuilder, CircomConfig};
use ark_groth16::{Groth16, ProvingKey, VerifyingKey, Proof};
use ark_serialize::{CanonicalSerialize, CanonicalDeserialize};
use ark_std::rand::thread_rng;
use ark_snark::SNARK; // Add this import for circuit_specific_setup, prove, and verify
use num_bigint::BigInt;
use std::collections::HashMap;

fn main() {
    let mut rng = thread_rng();
    
    let cfg = CircomConfig::<Fr>::new("./main.wasm", "./main.r1cs").unwrap();
    
    let mut builder = CircomBuilder::new(cfg);
    
    // Convert the integer to BigInt
    builder.push_input("step_in", BigInt::from(1));
    
    let circom = builder.build().unwrap();
    let circuit = circom.clone();
    
    // Now circuit_specific_setup should work with the SNARK trait imported
    let (pk, vk): (ProvingKey<Bn254>, VerifyingKey<Bn254>) = 
        Groth16::<Bn254>::circuit_specific_setup(circuit.clone(), &mut rng)
            .expect("Failed to run setup");
    
    println!("Setup complete!");
    
    // Generate proof
    let proof: Proof<Bn254> = Groth16::<Bn254>::prove(&pk, circuit, &mut rng)
        .expect("Failed to generate proof");
    
    println!("Proof generated!");
    
    // Get public inputs for verification
    let public_inputs = circom.get_public_inputs().unwrap();
    
    // Verify the proof
    let verified = Groth16::<Bn254>::verify(&vk, &public_inputs, &proof)
        .expect("Failed to verify proof");
    
    if verified {
        println!("Proof verified successfully!");
    } else {
        println!("Proof verification failed!");
    }
}