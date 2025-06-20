use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    program::invoke,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

fn process_instruction(
    _public_key: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let mut iter = accounts.iter(); // Get iterator for accounts
    // Extract data account and target contract address
    let data_account = next_account_info(&mut iter)?;
    let double_contract_address = next_account_info(&mut iter)?;
    if !data_account.is_signer {
        return ProgramResult::Err(
            solana_program::program_error::ProgramError::MissingRequiredSignature,
        );
    }

    // Create instruction for cross-program invocation
    let instruction = Instruction {
        program_id: *double_contract_address.key,
        accounts: vec![AccountMeta {
            is_signer: true,
            is_writable: true,
            pubkey: *data_account.key,
        }],
        data: instruction_data.to_vec(),
    };

    // CPI - Invoke the target program with the instruction
    invoke(&instruction, &[data_account.clone()])?;
    Ok(())
}
