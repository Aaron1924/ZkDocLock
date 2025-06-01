use ark_bn254::{Bn254, Fr};
use ark_circom::{CircomBuilder, CircomConfig};
use ark_groth16::{Groth16, ProvingKey, VerifyingKey, Proof};
use ark_std::rand::thread_rng;
use ark_snark::SNARK;
use ark_serialize::CanonicalSerialize;
use num_bigint::BigInt;
use std::path::{Path, PathBuf};
use std::fs;
use std::env;

fn main() {
    // Create a multi-threaded Tokio runtime explicitly
    let rt = tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime");

    // Run the async code in the runtime
    let result = rt.block_on(async {
        run_zkproof().await
    });

    if let Err(e) = result {
        eprintln!("Error: {}", e);
    }
}

fn get_circom_files_from_args() -> Option<(String, String)> {
    let args: Vec<String> = env::args().collect();
    if args.len() >= 3 {
        let wasm_path = &args[1];
        let r1cs_path = &args[2];
        if Path::new(wasm_path).exists() && Path::new(r1cs_path).exists() {
            return Some((wasm_path.clone(), r1cs_path.clone()));
        }
    }
    None
}

fn find_circom_files() -> Result<(PathBuf, PathBuf), Box<dyn std::error::Error>> {
    // First check command line arguments
    if let Some((wasm_path, r1cs_path)) = get_circom_files_from_args() {
        println!("Using files from command line arguments:");
        println!("  WASM: {}", wasm_path);
        println!("  R1CS: {}", r1cs_path);
        return Ok((PathBuf::from(wasm_path), PathBuf::from(r1cs_path)));
    }

    let search_paths = vec![
        ".",                           // Current directory
        "./main_js",                   // Circom output directory
        "../main_js",                  // Parent main_js directory
        "./circom",                    // circom subdirectory
        "../circom",                   // Parent circom directory
        "./circuits",                  // circuits subdirectory
        "../circuits",                 // Parent circuits directory
        "./build",                     // build directory
        "../build",                    // Parent build directory
        "../../circom",                // Two levels up circom directory
    ];
    
    // First, try to find main.wasm and main.r1cs specifically
    for base_path in &search_paths {
        let wasm_path = Path::new(base_path).join("main.wasm");
        let r1cs_path = Path::new(base_path).join("main.r1cs");
        
        if wasm_path.exists() && r1cs_path.exists() {
            println!("Found Circom files in: {}", base_path);
            println!("  WASM: {}", wasm_path.display());
            println!("  R1CS: {}", r1cs_path.display());
            return Ok((wasm_path, r1cs_path));
        }
    }
    
    // If main.* files not found, search for any .wasm and .r1cs files
    println!("main.wasm/main.r1cs not found, searching for any Circom files...");
    
    for base_path in &search_paths {
        if let Ok(entries) = fs::read_dir(base_path) {
            let mut wasm_files = Vec::new();
            let mut r1cs_files = Vec::new();
            
            for entry in entries.flatten() {
                let path = entry.path();
                if let Some(extension) = path.extension() {
                    match extension.to_str() {
                        Some("wasm") => wasm_files.push(path),
                        Some("r1cs") => r1cs_files.push(path),
                        _ => {}
                    }
                }
            }
            
            // Try to find matching pairs (same filename, different extension)
            for wasm_path in &wasm_files {
                let wasm_stem = wasm_path.file_stem().unwrap();
                for r1cs_path in &r1cs_files {
                    let r1cs_stem = r1cs_path.file_stem().unwrap();
                    if wasm_stem == r1cs_stem {
                        println!("Found matching Circom files in: {}", base_path);
                        println!("  WASM: {}", wasm_path.display());
                        println!("  R1CS: {}", r1cs_path.display());
                        return Ok((wasm_path.clone(), r1cs_path.clone()));
                    }
                }
            }
        }
    }
    
    // Provide helpful error message with compilation instructions
    Err(format!(
        "Could not find Circom files (.wasm and .r1cs) in any expected directory.\n\
         Searched in: {:?}\n\n\
         To generate these files, run:\n\
         1. Create a Circom circuit file (e.g., main.circom)\n\
         2. Compile it: circom main.circom --r1cs --wasm --sym\n\
         3. This will generate main.r1cs and main.wasm files",
        search_paths
    ).into())
}

async fn run_zkproof() -> Result<(), Box<dyn std::error::Error>> {
    // Hardcoded file paths
    let wasm_path = r"C:\Users\pkhoa\projects\Sui\zkdoclock\zkdoclock-app\src\zkproof\src\main_js\main.wasm";
    let r1cs_path = r"C:\Users\pkhoa\projects\Sui\zkdoclock\zkdoclock-app\src\zkproof\src\main.r1cs";

    // Check if files exist
    if !Path::new(wasm_path).exists() {
        return Err(format!("WASM file not found: {}", wasm_path).into());
    }
    if !Path::new(r1cs_path).exists() {
        return Err(format!("R1CS file not found: {}", r1cs_path).into());
    }

    println!("Using hardcoded file paths:");
    println!("  WASM: {}", wasm_path);
    println!("  R1CS: {}", r1cs_path);
    println!("Creating CircomConfig...");

    let mut rng = thread_rng();
    
    let cfg = CircomConfig::<Fr>::new(wasm_path, r1cs_path)
        .map_err(|e| format!("Failed to create CircomConfig: {}", e))?;
    
    println!("CircomConfig created, building circuit...");
    
    let mut builder = CircomBuilder::new(cfg);
    builder.push_input("step_in", BigInt::from(3));
    
    let circom = builder.build()
        .map_err(|e| format!("Failed to build circuit: {}", e))?;
    
    let circuit = circom.clone();
    
    println!("Circuit built, starting setup...");
    
    let (pk, vk): (ProvingKey<Bn254>, VerifyingKey<Bn254>) = 
        Groth16::<Bn254>::circuit_specific_setup(circuit.clone(), &mut rng)
            .map_err(|e| format!("Failed to run setup: {}", e))?;
    
    println!("Setup complete! Generating proof...");
    
    let proof: Proof<Bn254> = Groth16::<Bn254>::prove(&pk, circuit, &mut rng)
        .map_err(|e| format!("Failed to generate proof: {}", e))?;
    
    println!("Proof generated! Getting public inputs...");
    
    // Fix: get_public_inputs() returns Option, not Result
    let public_inputs = circom.get_public_inputs()
        .ok_or("Failed to get public inputs")?;
    
    println!("Public inputs: {:?}", public_inputs);
    
    println!("Verifying proof...");
    let verified = Groth16::<Bn254>::verify(&vk, &public_inputs, &proof)
        .map_err(|e| format!("Failed to verify proof: {}", e))?;
    
    // Serialize to hex
    let mut proof_bytes = Vec::new();
    proof.serialize_compressed(&mut proof_bytes)
        .map_err(|e| format!("Failed to serialize proof: {}", e))?;
    let proof_hex = hex::encode(&proof_bytes);
    
    let mut public_inputs_bytes = Vec::new();
    public_inputs.serialize_compressed(&mut public_inputs_bytes)
        .map_err(|e| format!("Failed to serialize public inputs: {}", e))?;
    let public_inputs_hex = hex::encode(&public_inputs_bytes);
    
    let mut vk_bytes = Vec::new();
    vk.serialize_compressed(&mut vk_bytes)
        .map_err(|e| format!("Failed to serialize verifying key: {}", e))?;
    let vk_hex = hex::encode(&vk_bytes);
    
    if verified {
        println!("✅ Proof verified successfully!");
        println!("Input: 3, Output: 9 (3²)");
        println!();
        println!("Proof (hex): {}", proof_hex);
        println!("Public inputs (hex): {}", public_inputs_hex);
        println!("Verifying key (hex): {}", vk_hex);
    } else {
        println!("❌ Proof verification failed!");
    }

    Ok(())
}