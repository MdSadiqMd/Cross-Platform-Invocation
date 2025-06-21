import * as path from "path";
import {
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    Transaction,
    TransactionInstruction
} from "@solana/web3.js";
import { LiteSVM } from "litesvm";
import { expect, test, describe, beforeEach } from "bun:test";
import { deserialize } from "borsh";
import * as borsh from "borsh";

class CounterState {
    count: number;

    constructor(count: number) {
        this.count = count;
    }

    static schema: borsh.Schema = {
        struct: {
            count: 'u32'
        }
    };
}

describe("Counter Program Tests", () => {
    let svm: LiteSVM;
    let doubleProgramId: PublicKey;
    let cpiProgramId: PublicKey;
    let dataAccountPDA: PublicKey;
    let pdaBump: number;
    let userAccount: Keypair;

    const cpiProgramPath = path.join(import.meta.dir, "double_it_on_pda.so");
    const doubleProgramPath = path.join(import.meta.dir, "double_it_on_pda.so");

    beforeEach(() => {
        svm = new LiteSVM();

        cpiProgramId = PublicKey.unique();
        doubleProgramId = PublicKey.unique();

        svm.addProgramFromFile(cpiProgramId, cpiProgramPath);
        svm.addProgramFromFile(doubleProgramId, doubleProgramPath);

        userAccount = new Keypair();
        svm.airdrop(userAccount.publicKey, BigInt(LAMPORTS_PER_SOL));

        // Derive the PDA that the contract expects
        [dataAccountPDA, pdaBump] = PublicKey.findProgramAddressSync(
            [Buffer.from("data_account"), userAccount.publicKey.toBuffer()],
            cpiProgramId
        );

        // Don't create the PDA here - let the program handle it
        // The PDA will be created/initialized by the program itself
    });

    test("double counter value makes it 1 for the first time", () => {
        // Call the CPI program which will invoke the double program
        const instruction = new TransactionInstruction({
            programId: cpiProgramId,
            keys: [
                { pubkey: dataAccountPDA, isSigner: false, isWritable: true },
                { pubkey: userAccount.publicKey, isSigner: true, isWritable: false },
                { pubkey: doubleProgramId, isSigner: false, isWritable: false },
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false } // Add System Program for PDA creation
            ],
            data: Buffer.from([])
        });

        const transaction = new Transaction().add(instruction);
        transaction.recentBlockhash = svm.latestBlockhash();
        transaction.feePayer = userAccount.publicKey;
        transaction.sign(userAccount);

        let txn = svm.sendTransaction(transaction);
        console.log("Transaction result:", txn.toString());

        // Verify the counter was incremented
        const updatedAccountData = svm.getAccount(dataAccountPDA);
        if (!updatedAccountData) {
            throw new Error("PDA account not found");
        }

        const updatedCounter = deserialize(CounterState.schema, updatedAccountData.data) as CounterState;
        if (!updatedCounter) {
            throw new Error("Counter not found");
        }

        expect(updatedCounter.count).toBe(1);
    });

    test("double counter value makes it 8 after 4 times", () => {
        function callCPIProgram() {
            const instruction = new TransactionInstruction({
                programId: cpiProgramId,
                keys: [
                    { pubkey: dataAccountPDA, isSigner: false, isWritable: true },
                    { pubkey: userAccount.publicKey, isSigner: true, isWritable: false },
                    { pubkey: doubleProgramId, isSigner: false, isWritable: false },
                    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
                ],
                data: Buffer.from([])
            });

            const transaction = new Transaction().add(instruction);
            transaction.recentBlockhash = svm.latestBlockhash();
            transaction.feePayer = userAccount.publicKey;
            transaction.sign(userAccount);

            svm.sendTransaction(transaction);
            svm.expireBlockhash();
        }

        // Call the CPI program 4 times
        callCPIProgram(); // 0 -> 1
        callCPIProgram(); // 1 -> 2  
        callCPIProgram(); // 2 -> 4
        callCPIProgram(); // 4 -> 8

        // Verify the final counter value
        const updatedAccountData = svm.getAccount(dataAccountPDA);
        if (!updatedAccountData) {
            throw new Error("PDA account not found");
        }

        const updatedCounter = deserialize(CounterState.schema, updatedAccountData.data) as CounterState;
        if (!updatedCounter) {
            throw new Error("Counter not found");
        }

        expect(updatedCounter.count).toBe(8);
    });

    test("direct call to double program works", () => {
        // First, we need to create a regular account for direct calls since the double program
        // might not handle PDA creation itself
        const regularAccount = new Keypair();

        // Create regular account for direct program call
        const createAccountIx = SystemProgram.createAccount({
            fromPubkey: userAccount.publicKey,
            newAccountPubkey: regularAccount.publicKey,
            lamports: Number(svm.minimumBalanceForRentExemption(BigInt(4))),
            space: 4,
            programId: doubleProgramId
        });

        const createTx = new Transaction().add(createAccountIx);
        createTx.recentBlockhash = svm.latestBlockhash();
        createTx.feePayer = userAccount.publicKey;
        createTx.sign(userAccount, regularAccount);
        svm.sendTransaction(createTx);

        // Test calling the double program directly
        const instruction = new TransactionInstruction({
            programId: doubleProgramId,
            keys: [
                { pubkey: regularAccount.publicKey, isSigner: false, isWritable: true }
            ],
            data: Buffer.from([])
        });

        const transaction = new Transaction().add(instruction);
        transaction.recentBlockhash = svm.latestBlockhash();
        transaction.feePayer = userAccount.publicKey;
        transaction.sign(userAccount);

        svm.sendTransaction(transaction);

        // Verify the counter was incremented
        const updatedAccountData = svm.getAccount(regularAccount.publicKey);
        if (!updatedAccountData) {
            throw new Error("Account not found");
        }

        const updatedCounter = deserialize(CounterState.schema, updatedAccountData.data) as CounterState;
        if (!updatedCounter) {
            throw new Error("Counter not found");
        }

        expect(updatedCounter.count).toBe(1);
    });
});
