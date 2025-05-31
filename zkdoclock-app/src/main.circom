pragma circom 2.1.5;

include "circomlib/sha256.circom";

template Main() {
    signal input document[256]; // Input tài liệu (256 bits ví dụ)
    signal input id_rec[256];   // Hash mong muốn
    signal output valid;

    component sha256 = Sha256(256);
    sha256.in <== document;
    valid <== (sha256.out == id_rec);
}

component main = Main();