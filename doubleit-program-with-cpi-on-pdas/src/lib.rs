use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint,
    entrypoint::ProgramResult,
    instruction::{AccountMeta, Instruction},
    program::invoke_signed,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    _program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let mut iter = accounts.iter();
    let pda = next_account_info(&mut iter)?;
    let user_pubkey = next_account_info(&mut iter)?;
    let double_contract_program = next_account_info(&mut iter)?;

    let instruction = Instruction {
        program_id: *double_contract_program.key,
        accounts: vec![AccountMeta::new(*pda.key, true)],
        data: instruction_data.to_vec(),
    };

    let pda_seeds: &[&[u8]] = &[b"data_account", user_pubkey.key.as_ref()];

    invoke_signed(&instruction, &[pda.clone()], &[&pda_seeds])?;

    Ok(())
}
